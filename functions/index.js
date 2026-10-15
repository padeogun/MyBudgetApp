const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const nodemailer = require("nodemailer");

initializeApp();

const GMAIL_USER = defineSecret("GMAIL_USER");
const GMAIL_APP_PASSWORD = defineSecret("GMAIL_APP_PASSWORD");

// ─── Helpers ──────────────────────────────────────────────────

function fmtGBP(n) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

// ─── Nudge computation (mirrors frontend computeNudges) ───────

function computeNudges(state) {
  const nudges = [];
  const today = new Date();

  // bill_due — recurring items due within 7 days
  (state.recurring || []).filter(r => r.active).forEach(r => {
    const days = daysUntil(r.nextDue);
    if (days <= 7) {
      nudges.push({
        id: "virtual-bill-" + r.id,
        type: "bill_due",
        severity: days < 0 ? "alert" : days <= 1 ? "warning" : "info",
        title: days < 0
          ? `${r.payee} is overdue`
          : days === 0 ? `${r.payee} due today`
          : `${r.payee} due in ${days} day${days !== 1 ? "s" : ""}`,
        body: fmtGBP(r.amount) + " · " + r.frequency,
        daysUntilDue: days,
      });
    }
  });

  // budget_threshold — budgets over 80%
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  (state.budgets || []).forEach(b => {
    const spent = (state.transactions || [])
      .filter(t =>
        t.direction === "expense" &&
        new Date(t.date) >= monthStart &&
        (!b.categoryId || t.categoryId === b.categoryId)
      )
      .reduce((s, t) => s + t.amount, 0);
    const pct = b.amount > 0 ? (spent / b.amount) * 100 : 0;
    const cat = (state.categories || []).find(c => c.id === b.categoryId);
    const label = cat?.name || "Overall";
    if (pct > 100) {
      nudges.push({
        id: "virtual-budget-over-" + b.id,
        type: "budget_threshold",
        severity: "alert",
        title: `${label} budget exceeded`,
        body: `${fmtGBP(spent)} spent of ${fmtGBP(b.amount)} limit`,
        pct,
      });
    } else if (pct >= 80) {
      nudges.push({
        id: "virtual-budget-risk-" + b.id,
        type: "budget_threshold",
        severity: "warning",
        title: `${label} budget at ${pct.toFixed(0)}%`,
        body: `${fmtGBP(b.amount - spent)} remaining`,
        pct,
      });
    }
  });

  // low_balance — current account below floor
  const floor = state.settings?.lowBalanceFloor ?? 200;
  const primaryAcc = (state.accounts || []).find(a => a.type === "current");
  if (primaryAcc && primaryAcc.balance < floor) {
    nudges.push({
      id: "virtual-low-balance-" + primaryAcc.id,
      type: "low_balance",
      severity: primaryAcc.balance < 0 ? "alert" : "warning",
      title: `Low balance on ${primaryAcc.name}`,
      body: `${fmtGBP(primaryAcc.balance)} · floor is ${fmtGBP(floor)}`,
    });
  }

  return nudges;
}

// ─── Routing: which nudges get email? ─────────────────────────
// Mirrors DEFAULT_NUDGE_RULES: alerts and warnings go to email,
// info stays in-app only.

function shouldEmail(nudge) {
  return nudge.severity === "alert" || nudge.severity === "warning";
}

// ─── Email template ───────────────────────────────────────────

function buildEmailHtml(nudges) {
  const rows = nudges.map(n => {
    const color = n.severity === "alert" ? "#E8566A"
                : n.severity === "warning" ? "#F4A535"
                : "#02A8B9";
    return `
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #eee;">
          <div style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:8px;vertical-align:middle;"></div>
          <strong style="color:#1F2C2C;">${n.title}</strong>
          <div style="color:#7A8181;font-size:13px;margin-top:4px;padding-left:16px;">${n.body}</div>
        </td>
      </tr>`;
  }).join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f7f7;margin:0;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
    <div style="background:#02A8B9;padding:20px 24px;">
      <span style="color:#fff;font-size:18px;font-weight:700;">Bappy</span>
      <span style="color:rgba(255,255,255,.7);font-size:13px;margin-left:8px;">Daily nudge summary</span>
    </div>
    <div style="padding:16px 24px;">
      <p style="color:#1F2C2C;margin:0 0 16px;font-size:15px;">
        You have <strong>${nudges.length} nudge${nudges.length !== 1 ? "s" : ""}</strong> that need your attention:
      </p>
      <table style="width:100%;border-collapse:collapse;">${rows}</table>
      <p style="color:#7A8181;font-size:12px;margin:20px 0 0;">
        Open <a href="https://bappy-app.web.app" style="color:#02A8B9;">Bappy</a> to act on these.
      </p>
    </div>
  </div>
</body>
</html>`;
}

// ─── Scheduled function — runs daily at 08:00 London time ─────

exports.dailyNudgeEmail = onSchedule(
  {
    schedule: "0 8 * * *",
    timeZone: "Europe/London",
    secrets: [GMAIL_USER, GMAIL_APP_PASSWORD],
  },
  async () => {
    const db = getFirestore();
    const auth = getAuth();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_USER.value(),
        pass: GMAIL_APP_PASSWORD.value(),
      },
    });

    const todayStr = new Date().toISOString().slice(0, 10);

    // Fetch all user documents
    const snapshot = await db.collection("users").get();

    const results = await Promise.allSettled(
      snapshot.docs.map(async doc => {
        const uid = doc.id;
        const state = doc.data();

        // Skip if already emailed today
        if (state.lastNudgeEmailDate === todayStr) return;

        // Get user's email from Firebase Auth
        let userEmail;
        try {
          const userRecord = await auth.getUser(uid);
          userEmail = userRecord.email;
        } catch {
          return; // user deleted or no email
        }
        if (!userEmail) return;

        // Compute nudges and filter by user's type preferences
        const nudgeTypePrefs = state.nudgeTypePrefs || {};
        const allNudges = computeNudges(state).filter(n => {
          const pref = nudgeTypePrefs[n.type];
          // enabled by default unless explicitly disabled
          return pref === undefined ? true : pref.enabled !== false;
        });

        const emailNudges = allNudges.filter(shouldEmail);
        if (emailNudges.length === 0) return;

        await transporter.sendMail({
          from: `"Bappy" <${GMAIL_USER.value()}>`,
          to: userEmail,
          subject: `${emailNudges.length} nudge${emailNudges.length !== 1 ? "s" : ""} need your attention`,
          html: buildEmailHtml(emailNudges),
        });

        // Record that we emailed today to prevent duplicates
        await doc.ref.update({ lastNudgeEmailDate: todayStr });

        console.log(`Emailed ${emailNudges.length} nudges to ${uid}`);
      })
    );

    const failed = results.filter(r => r.status === "rejected");
    if (failed.length > 0) {
      console.error(`${failed.length} user(s) failed:`, failed.map(r => r.reason));
    }
  }
);
