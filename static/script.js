/* ==========================================================================
   ODYSSEY OS — Autonomous Travel Intelligence Platform
   Frontend Orchestration Client
   ========================================================================== */

let currentThreadId = localStorage.getItem("odyssey_thread_id") || localStorage.getItem("travel_thread_id") || null;
let latestAnswerMarkdown = "";
let waitingForApproval = false;
let currentDossierData = null;
let errorToastTimeout = null;

// Specialist Agent Definitions for the Matrix Visualizer
const ALL_AGENTS = [
  { id: "flight_agent", name: "Flight Scout", icon: "✈️", desc: "Aviation telemetry & route pricing" },
  { id: "hotel_agent", name: "Lodging & Stays", icon: "🏨", desc: "Hospitality & neighborhood search" },
  { id: "weather_agent", name: "Climate & Weather", icon: "🌦️", desc: "Forecasts & seasonal modeling" },
  { id: "budget_agent", name: "Fiscal Auditor", icon: "💰", desc: "Cost boundaries & feasibility" },
  { id: "itinerary_agent", name: "Itinerary Architect", icon: "🗺️", desc: "Integrated day-by-day synthesis" }
];

// Curated Expedition Scenarios
const PROMPT_CATEGORIES = {
  curated: [
    {
      title: "🗾 Tokyo & Kyoto Cultural Odyssey",
      meta: "7 Days • Shinkansen rail, boutique ryokans & Michelin dining",
      prompt: "Plan a complete 7-day Japan expedition covering Tokyo and Kyoto, including flights, boutique ryokan stays, Shinkansen travel, and cultural sightseeing under $3,500."
    },
    {
      title: "🍋 Amalfi Coast & Capri Scenic Retreat",
      meta: "5 Days • Cliffside boutique stays & Mediterranean ferry routes",
      prompt: "Plan a luxury 5-day Amalfi Coast and Capri getaway from Rome including boutique hotels, scenic transport, and coastal dining under $4,000."
    },
    {
      title: "🌌 Iceland Ring Road & Aurora Expedition",
      meta: "5 Days • Glacier lagoons, geothermal baths & Northern Lights",
      prompt: "Plan a 5-day Iceland winter adventure from London exploring Reykjavik, the Golden Circle, ice caves, and Northern Lights viewing with 4-star stays under $3,000."
    }
  ],
  alpine: [
    {
      title: "🏔️ Swiss Alps & Glacier Express",
      meta: "6 Days • Zermatt, Matterhorn, alpine rail & scenic chalets",
      prompt: "Plan a 6-day Swiss Alps winter retreat covering Zurich, Zermatt, and the Glacier Express scenic train with mountain-view hotels under $4,500."
    },
    {
      title: "🌲 Canadian Rockies Discovery",
      meta: "7 Days • Banff, Lake Louise & Jasper national park exploration",
      prompt: "Plan a 7-day scenic road trip through Banff and Jasper from Calgary including mountain lodge accommodations and outdoor activities under $2,800."
    }
  ],
  cultural: [
    {
      title: "🏛️ Ancient Greece & Cycladic Isles",
      meta: "7 Days • Athens Acropolis, Delphi & Santorini sunsets",
      prompt: "Plan a 7-day Greece historical and island tour covering Athens archaeological landmarks and Santorini cliffside stays under $3,000."
    },
    {
      title: "🕌 Marrakech & Sahara Desert Luxury Camp",
      meta: "6 Days • Historic medinas, Atlas Mountains & desert stargazing",
      prompt: "Plan a 6-day cultural journey through Morocco including Marrakech medina riads, Atlas Mountain passes, and a luxury Sahara desert camp under $2,500."
    }
  ],
  coastal: [
    {
      title: "🏝️ Bali & Nusa Penida Wellness Escape",
      meta: "8 Days • Ubud jungle retreats, coastal villas & surfing",
      prompt: "Plan an 8-day tropical relaxation itinerary in Bali covering Ubud wellness retreats and coastal villas under $2,200."
    },
    {
      title: "🌊 Maui & Kauai Hawaiian Expedition",
      meta: "6 Days • Hana scenic highway, Na Pali coast & beach resorts",
      prompt: "Plan a 6-day scenic Hawaiian island hopping trip across Maui and Kauai including coastal resorts and nature excursions under $4,800."
    }
  ]
};

// ==========================================================================
// Initialization & Event Binding
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  renderPrompts("curated");
  setupInputListeners();
});

function setupInputListeners() {
  const userInput = document.getElementById("userInput");
  const charCount = document.getElementById("charCount");

  if (userInput && charCount) {
    userInput.addEventListener("input", () => {
      const len = userInput.value.length;
      charCount.textContent = `${len} character${len === 1 ? "" : "s"}`;
    });
  }
}

// Category Prompt Switcher
function switchCategory(categoryKey, tabElement) {
  document.querySelectorAll(".filter-chip").forEach(chip => chip.classList.remove("active"));
  if (tabElement) {
    tabElement.classList.add("active");
  }
  renderPrompts(categoryKey);
}

function renderPrompts(categoryKey) {
  const container = document.getElementById("quickPromptsContainer");
  if (!container) return;

  const items = PROMPT_CATEGORIES[categoryKey] || PROMPT_CATEGORIES.curated;
  container.innerHTML = "";

  items.forEach(item => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "prompt-btn";
    btn.onclick = () => setPrompt(item.prompt);

    btn.innerHTML = `
      <div class="prompt-btn-title">
        <span>${item.title}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      </div>
      <div class="prompt-btn-meta">${item.meta}</div>
    `;

    container.appendChild(btn);
  });
}

function setPrompt(text) {
  const input = document.getElementById("userInput");
  if (input) {
    input.value = text;
    input.focus();
    const charCount = document.getElementById("charCount");
    if (charCount) {
      charCount.textContent = `${text.length} characters`;
    }
    input.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

// Quick Refinement Chip Helper
function insertFeedback(text) {
  const feedbackInput = document.getElementById("approvalFeedback");
  if (feedbackInput) {
    const current = feedbackInput.value.trim();
    if (current) {
      feedbackInput.value = `${current}\n• ${text}`;
    } else {
      feedbackInput.value = `• ${text}`;
    }
    feedbackInput.focus();
  }
}

// Reset Session
function resetSession() {
  currentThreadId = null;
  localStorage.removeItem("odyssey_thread_id");
  localStorage.removeItem("travel_thread_id");
  waitingForApproval = false;

  document.getElementById("workflowSection")?.classList.add("hidden");
  document.getElementById("resultSection")?.classList.add("hidden");
  document.getElementById("approvalSection")?.classList.add("hidden");
  hideError();

  const userInput = document.getElementById("userInput");
  if (userInput) userInput.value = "";

  const charCount = document.getElementById("charCount");
  if (charCount) charCount.textContent = "0 characters";

  showToast("Session thread reset. Ready for a new expedition run.");
}

// Loading States
function setLoading(isLoading, mode = "draft") {
  const sendBtn = document.getElementById("sendBtn");
  const btnText = document.getElementById("btnText");
  const btnLoader = document.getElementById("btnLoader");
  const approveBtn = document.getElementById("approveBtn");
  const reviseBtn = document.getElementById("reviseBtn");

  if (sendBtn) sendBtn.disabled = isLoading;
  if (approveBtn) approveBtn.disabled = isLoading;
  if (reviseBtn) reviseBtn.disabled = isLoading;

  if (isLoading && mode === "draft") {
    btnText?.classList.add("hidden");
    btnLoader?.classList.remove("hidden");
  } else {
    btnText?.classList.remove("hidden");
    btnLoader?.classList.add("hidden");
  }
}

// Toast & Error Management
function showError(message) {
  const errorBox = document.getElementById("errorBox");
  const errorText = document.getElementById("errorText");
  if (!errorBox) return;

  if (errorText) errorText.textContent = message;
  errorBox.classList.remove("hidden");

  clearTimeout(errorToastTimeout);
  errorToastTimeout = setTimeout(() => {
    hideError();
  }, 7000);
}

function hideError() {
  const errorBox = document.getElementById("errorBox");
  if (errorBox) {
    errorBox.classList.add("hidden");
  }
}

function showToast(message) {
  showError(message);
}

// Markdown Rendering Helper with Robust Type Normalization
function normalizeMarkdownString(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (Array.isArray(val)) {
    return val
      .map(item => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          return item.text || item.content || JSON.stringify(item, null, 2);
        }
        return String(item);
      })
      .filter(Boolean)
      .join("\n\n");
  }
  if (typeof val === "object") {
    return val.text || val.content || JSON.stringify(val, null, 2);
  }
  return String(val);
}

function renderMarkdown(element, markdown) {
  if (!element) return;
  const safeStr = normalizeMarkdownString(markdown);
  if (typeof marked !== "undefined") {
    try {
      element.innerHTML = marked.parse(safeStr);
    } catch (err) {
      console.warn("Markdown parse fallback:", err);
      element.innerText = safeStr;
    }
  } else {
    element.innerText = safeStr;
  }
}

// ==========================================================================
// Workflow & Telemetry Display
// ==========================================================================

function showWorkflow(data) {
  const section = document.getElementById("workflowSection");
  const reasoning = document.getElementById("supervisorReasoning");
  const chipsContainer = document.getElementById("agentChips");
  const guardrailBadge = document.getElementById("guardrailBadge");
  const guardrailText = document.getElementById("guardrailText");

  if (!section) return;

  if (reasoning) {
    reasoning.textContent = data.supervisor_reasoning || "Supervisor routing completed with selected specialist agents.";
  }

  // Render Specialist Agent Status Matrix
  if (chipsContainer) {
    chipsContainer.innerHTML = "";
    const selectedList = data.selected_agents || [];

    ALL_AGENTS.forEach(agent => {
      const isEngaged = selectedList.includes(agent.id) || selectedList.length === 0;

      const card = document.createElement("div");
      card.className = `agent-card-item ${isEngaged ? "active" : ""}`;

      card.innerHTML = `
        <div class="agent-card-info">
          <span class="agent-card-icon">${agent.icon}</span>
          <div>
            <div class="agent-card-name">${agent.name}</div>
          </div>
        </div>
        <span class="agent-status-tag">${isEngaged ? "ENGAGED" : "STANDBY"}</span>
      `;

      chipsContainer.appendChild(card);
    });
  }

  // Guardrail Status
  if (guardrailBadge) {
    if (data.guardrail_allowed === false) {
      if (guardrailText) guardrailText.textContent = "Guardrail Blocked: Request Restricted";
      guardrailBadge.classList.add("blocked");
    } else {
      if (guardrailText) guardrailText.textContent = "Zero-Trust Guardrail: Verified";
      guardrailBadge.classList.remove("blocked");
    }
  }

  section.classList.remove("hidden");
}

// ==========================================================================
// Dossier Result Presentation
// ==========================================================================

function showResult(answer, threadId, isDraft = false, fullData = null) {
  latestAnswerMarkdown = answer || "";
  currentDossierData = fullData;

  const resultSection = document.getElementById("resultSection");
  const resultBox = document.getElementById("resultBox");
  const threadInfo = document.getElementById("threadInfo");
  const resultTitle = document.getElementById("resultTitle");

  if (!resultSection) return;

  renderMarkdown(resultBox, latestAnswerMarkdown);
  if (threadInfo) threadInfo.textContent = threadId || "LOCAL_EXEC";
  if (resultTitle) {
    resultTitle.textContent = isDraft 
      ? "Synthesized Draft Expedition Plan" 
      : "Finalized AI Expedition Dossier";
  }

  // Populate Intelligence Feeds if data present
  if (fullData) {
    populateAgentFeeds(fullData);
    populateConstraints(fullData.trip_constraints);
  }

  // Switch to Master Itinerary tab by default
  switchDossierTab("itinerary");

  resultSection.classList.remove("hidden");
  resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function populateAgentFeeds(data) {
  const flightBody = document.getElementById("flightFeedBody");
  const hotelBody = document.getElementById("hotelFeedBody");
  const weatherBody = document.getElementById("weatherFeedBody");
  const budgetBody = document.getElementById("budgetFeedBody");

  if (flightBody) {
    if (data.flight_results) {
      renderMarkdown(flightBody, data.flight_results);
    } else {
      flightBody.innerHTML = "<em>Standard flight routes and scheduled airfare integrated directly into master itinerary.</em>";
    }
  }

  if (hotelBody) {
    if (data.hotel_results) {
      renderMarkdown(hotelBody, data.hotel_results);
    } else {
      hotelBody.innerHTML = "<em>Accommodations and neighborhood lodging selections integrated into itinerary timeline.</em>";
    }
  }

  if (weatherBody) {
    if (data.weather_results) {
      renderMarkdown(weatherBody, data.weather_results);
    } else {
      weatherBody.innerHTML = "<em>Seasonal climate parameters and weather advisories incorporated into daily schedules.</em>";
    }
  }

  if (budgetBody) {
    if (data.budget_results) {
      renderMarkdown(budgetBody, data.budget_results);
    } else {
      budgetBody.innerHTML = "<em>Cost breakdown and expenditure allocations validated by fiscal agent.</em>";
    }
  }
}

function populateConstraints(constraints) {
  if (!constraints || typeof constraints !== "object") return;

  const destElem = document.getElementById("cTargetDest");
  const originElem = document.getElementById("cOrigin");
  const durElem = document.getElementById("cDuration");
  const budgetElem = document.getElementById("cBudget");

  if (destElem) destElem.textContent = constraints.destination || "Flexible / Multiple";
  if (originElem) originElem.textContent = constraints.origin || "User Local Hub";
  if (durElem) durElem.textContent = constraints.duration_days ? `${constraints.duration_days} Days` : "Calculated in Plan";
  if (budgetElem) budgetElem.textContent = constraints.budget || "Within Specified Limit";
}

// Dossier Tabs Switcher
function switchDossierTab(tabKey, tabButton) {
  document.querySelectorAll(".dossier-tab").forEach(tab => tab.classList.remove("active"));
  if (tabButton) {
    tabButton.classList.add("active");
  } else {
    // Find matching tab button
    const buttons = document.querySelectorAll(".dossier-tab");
    if (tabKey === "itinerary" && buttons[0]) buttons[0].classList.add("active");
    if (tabKey === "feeds" && buttons[1]) buttons[1].classList.add("active");
    if (tabKey === "constraints" && buttons[2]) buttons[2].classList.add("active");
  }

  const pdfContent = document.getElementById("pdfContent");
  const feedsContent = document.getElementById("agentFeedsContent");
  const constraintsContent = document.getElementById("tripConstraintsContent");

  pdfContent?.classList.add("hidden");
  feedsContent?.classList.add("hidden");
  constraintsContent?.classList.add("hidden");

  if (tabKey === "itinerary") {
    pdfContent?.classList.remove("hidden");
  } else if (tabKey === "feeds") {
    feedsContent?.classList.remove("hidden");
  } else if (tabKey === "constraints") {
    constraintsContent?.classList.remove("hidden");
  }
}

// ==========================================================================
// HITL Approval Console
// ==========================================================================

function showApproval(data) {
  waitingForApproval = true;
  const section = document.getElementById("approvalSection");
  const approvalRequest = document.getElementById("approvalRequest");

  if (approvalRequest) {
    approvalRequest.textContent = data.approval_request ||
      "The supervisor agent has paused execution at the Human-in-the-Loop checkpoint. Review the synthesized draft above, then authorize finalization or request specific revisions.";
  }

  if (section) {
    section.classList.remove("hidden");
    section.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function hideApproval() {
  waitingForApproval = false;
  document.getElementById("approvalSection")?.classList.add("hidden");
  const feedbackInput = document.getElementById("approvalFeedback");
  if (feedbackInput) feedbackInput.value = "";
}

// ==========================================================================
// API Interaction: Send Message (Dispatch Pipeline)
// ==========================================================================

async function sendMessage() {
  hideError();

  if (waitingForApproval) {
    showError("A draft is currently awaiting your review. Please authorize or request revisions below.");
    return;
  }

  const input = document.getElementById("userInput");
  const message = input ? input.value.trim() : "";

  if (!message) {
    showError("Please enter your expedition details before dispatching the pipeline.");
    input?.focus();
    return;
  }

  setLoading(true, "draft");

  try {
    const response = await fetch("/api/travel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: message,
        thread_id: currentThreadId
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "The autonomous agent pipeline encountered an issue.");
    }

    currentThreadId = data.thread_id;
    localStorage.setItem("odyssey_thread_id", currentThreadId);
    localStorage.setItem("travel_thread_id", currentThreadId);

    showWorkflow(data);

    if (data.requires_approval) {
      showResult(data.itinerary || data.answer, data.thread_id, true, data);
      showApproval(data);
    } else {
      hideApproval();
      showResult(data.answer, data.thread_id, false, data);
    }
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false, "draft");
  }
}

// ==========================================================================
// API Interaction: Submit Approval / Revision
// ==========================================================================

async function submitApproval(approved) {
  hideError();

  if (!currentThreadId || !waitingForApproval) {
    showError("There is no active draft awaiting authorization.");
    return;
  }

  const feedbackInput = document.getElementById("approvalFeedback");
  const feedback = feedbackInput ? feedbackInput.value.trim() : "";

  if (!approved && !feedback) {
    showError("Please provide specific revision guidance before requesting changes.");
    feedbackInput?.focus();
    return;
  }

  setLoading(true, "approval");

  try {
    const response = await fetch("/api/travel/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        thread_id: currentThreadId,
        approved: approved,
        feedback: feedback
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Could not resume the agent workflow.");
    }

    showWorkflow(data);
    hideApproval();
    showResult(data.answer, data.thread_id, false, data);
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false, "approval");
  }
}

// ==========================================================================
// Export & Clipboard Helpers
// ==========================================================================

function copyResult() {
  const resultBox = document.getElementById("resultBox");
  const text = resultBox ? resultBox.innerText : "";

  if (!text) {
    showError("No itinerary dossier content to copy.");
    return;
  }

  navigator.clipboard.writeText(text)
    .then(() => {
      const copyBtnText = document.getElementById("copyBtnText");
      if (copyBtnText) {
        const orig = copyBtnText.textContent;
        copyBtnText.textContent = "Copied to Clipboard!";
        setTimeout(() => {
          copyBtnText.textContent = orig;
        }, 1800);
      }
    })
    .catch(() => {
      showError("Unable to copy to clipboard.");
    });
}

function downloadPDF() {
  const pdfContent = document.getElementById("pdfContent");

  if (!latestAnswerMarkdown || !pdfContent) {
    showError("No dossier content ready for PDF compilation.");
    return;
  }

  // Make sure Master Itinerary tab is active
  switchDossierTab("itinerary");

  const downloadBtnText = document.getElementById("downloadBtnText");
  const oldText = downloadBtnText ? downloadBtnText.textContent : "Export Executive PDF";
  if (downloadBtnText) downloadBtnText.textContent = "Compiling PDF...";

  const options = {
    margin: [0.6, 0.6, 0.6, 0.6],
    filename: `odyssey-dossier-${currentThreadId || "travel"}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff"
    },
    jsPDF: {
      unit: "in",
      format: "a4",
      orientation: "portrait"
    },
    pagebreak: { mode: ["avoid-all", "css", "legacy"] }
  };

  html2pdf()
    .set(options)
    .from(pdfContent)
    .save()
    .then(() => {
      if (downloadBtnText) downloadBtnText.textContent = oldText;
    })
    .catch(() => {
      if (downloadBtnText) downloadBtnText.textContent = oldText;
      showError("Could not compile executive PDF document.");
    });
}

// Keyboard Shortcut: Ctrl + Enter / Command + Enter
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    sendMessage();
  }
});
