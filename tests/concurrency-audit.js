const BASE_URL = process.env.API_BASE || "http://localhost:5000";

const TEAM_ID = process.env.TEAM_ID;
const REQUEST_A_ID = process.env.REQUEST_A_ID;
const REQUEST_B_ID = process.env.REQUEST_B_ID;
const LEADER_TOKEN = process.env.LEADER_TOKEN;

const required = {
  TEAM_ID,
  REQUEST_A_ID,
  REQUEST_B_ID,
  LEADER_TOKEN,
};

for (const [name, value] of Object.entries(required)) {
  if (!value) {
    console.error(`Missing environment variable: ${name}`);
    process.exit(1);
  }
}

const headers = {
  Authorization: `Bearer ${LEADER_TOKEN}`,
  "Content-Type": "application/json",
};

async function api(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers,
    ...options,
  });

  const body = await response.json();

  return {
    status: response.status,
    body,
  };
}

async function reviewRequest(requestId) {
  return api(`/api/teams/${TEAM_ID}/join-requests/${requestId}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "accepted",
    }),
  });
}

async function getHistory(requestId) {
  return api(`/api/teams/${TEAM_ID}/join-requests/${requestId}/history`);
}

async function runAudit() {
  console.log("Starting concurrent acceptance test...");

  // Two acceptance requests at approximately
  // the same time
  const [responseA, responseB] = await Promise.all([
    reviewRequest(REQUEST_A_ID),
    reviewRequest(REQUEST_B_ID),
  ]);

  console.table([
    {
      student: "A",
      httpStatus: responseA.status,
      message: responseA.body.message,
    },
    {
      student: "B",
      httpStatus: responseB.status,
      message: responseB.body.message,
    },
  ]);

  // Read final database-backed state
  const [teamResult, historyA, historyB] = await Promise.all([
    api(`/api/teams/${TEAM_ID}`),
    getHistory(REQUEST_A_ID),
    getHistory(REQUEST_B_ID),
  ]);

  if (
    teamResult.status !== 200 ||
    historyA.status !== 200 ||
    historyB.status !== 200
  ) {
    throw new Error("Failed to verify final state");
  }

  const team = teamResult.body.team;

  const requests = [historyA.body.request, historyB.body.request];

  const accepted = requests.filter(
    (request) => request.currentStatus === "accepted",
  );

  const pending = requests.filter(
    (request) => request.currentStatus === "pending",
  );

  const memberIds = new Set(
    team.members.map((member) => String(member.user?._id ?? member.user)),
  );

  const membershipValid = requests.every((request) => {
    const isMember = memberIds.has(String(request.user));

    return request.currentStatus === "accepted" ? isMember : !isMember;
  });

  const historyValid = requests.every((request) => {
    const lastEvent = request.statusHistory?.at(-1);

    return lastEvent?.toStatus === request.currentStatus;
  });

  const successCount = [responseA, responseB].filter(
    (response) => response.status === 200,
  ).length;

  const expectedHttpResults =
    successCount === 1 &&
    [responseA, responseB].every((response) =>
      [200, 400, 409].includes(response.status),
    );

  const passed =
    expectedHttpResults &&
    team.members.length === 2 &&
    team.maxMembers === 2 &&
    team.status === "full" &&
    accepted.length === 1 &&
    pending.length === 1 &&
    membershipValid &&
    historyValid;

  console.log("\nFinal verification:");
  console.table({
    members: team.members.length,
    maxMembers: team.maxMembers,
    teamStatus: team.status,
    acceptedRequests: accepted.length,
    pendingRequests: pending.length,
    membershipValid,
    historyValid,
  });

  console.log(
    passed
      ? "PASS: Concurrency invariants preserved"
      : "FAIL: Investigate responses and database state",
  );

  if (!passed) {
    process.exitCode = 1;
  }
}

runAudit().catch((error) => {
  console.error("Audit error:", error);
  process.exitCode = 1;
});
