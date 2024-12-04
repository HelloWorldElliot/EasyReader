const MAX_MODEL_CHARS = 4000;

let pageContent = "";

const summaryElement = document.body.querySelector("#summary");
const languageSelect = document.querySelector("#language");
const settingsTab = document.querySelector("#settings-tab");
const settingsPanel = document.querySelector("#settings-panel");
const settingsCard = document.querySelector("#card");
const cardContainer = document.getElementById("card-container");

function onConfigChange() {
  const oldContent = pageContent;
  pageContent = "";
  onContentChange(oldContent);
}

[languageSelect].forEach((e) => e.addEventListener("change", onConfigChange));

chrome.storage.session.get("pageContent", ({ pageContent }) => {
  onContentChange(pageContent);
});

chrome.storage.session.onChanged.addListener((changes) => {
  const pageContent = changes["pageContent"];
  onContentChange(pageContent.newValue);
  const cardContainer = document.getElementById("card-container");
  if (cardContainer) {
    cardContainer.innerHTML = ""; // Clear the cards inside the container
  }
});

async function onContentChange(newContent) {
  if (pageContent == newContent) {
    // no new content, do nothing
    return;
  }
  pageContent = newContent;
  let summary;
  if (newContent) {
    showSummary("Loading...");
    summary = await generateSummary(newContent);
  } else {
    summary = "There's nothing to summarize";
  }
  if (languageSelect.value !== "en") {
    try {
      summary = await translateText(summary, languageSelect.value);
    } catch (error) {
      console.error("Error during translation:", error);
    }
  }
  showSummary(summary);
}
async function translateText(sourceContent, targetLanguage) {
  try {
    const translator = await createTranslator("en", targetLanguage);
    return await translator.translate(sourceContent);
  } catch (error) {
    console.error("Translation failed:", error);
    return "Translation error: Unable to process the text.";
  }
}
async function createTranslator(sourceLanguage, targetLanguage) {
  if (!self.translation) {
    console.log("No translation model");
    throw new Error("AI Translation is not supported in this browser");
  }
  const translator = await self.translation.createTranslator({
    sourceLanguage,
    targetLanguage,
  });
  return translator;
}
async function generateSummary(text) {
  try {
    const session = await createSummarizer(
      {
        type: "key-points",
        format: "markdown",
        length: "short",
      },
      (message, progress) => {
        console.log(`${message} (${progress.loaded}/${progress.total})`);
      }
    );
    const chunks = [];
    let startIndex = 0;
    while (startIndex < text.length) {
      const chunk = text.slice(startIndex, startIndex + MAX_MODEL_CHARS);
      chunks.push(chunk);
      startIndex += MAX_MODEL_CHARS;
    }
    let finalSummary = "";
    for (let i = 0; i < chunks.length; i++) {
      const chunkSummary = await session.summarize(chunks[i]);
      finalSummary += chunkSummary + "\n";
    }
    finalSummary.trim();
    // const summary = await session.summarize(text, {
    //   context: "This is a news article.",
    // });
    session.destroy();
    return finalSummary;
  } catch (e) {
    console.log("Summary generation failed");
    console.error(e);
    return "Error: " + e.message;
  }
}

async function createSummarizer(config, downloadProgressCallback) {
  if (!"ai" in self || !"summarizer" in self.ai) {
    throw new Error("AI Summarization is not supported in this browser");
  }
  const canSummarize = await self.ai.summarizer.capabilities();
  if (canSummarize.available === "no") {
    throw new Error("AI Summarization is not supported");
  }
  const summarizationSession = await self.ai.summarizer.create(
    config,
    downloadProgressCallback
  );
  if (canSummarize.available === "after-download") {
    summarizationSession.addEventListener(
      "downloadprogress",
      downloadProgressCallback
    );
    await summarizationSession.ready;
  }
  return summarizationSession;
}

async function showSummary(text) {
  //summaryElement.innerHTML = text;
  const formattedText = text
    .split("*")
    .filter((line) => line.trim() !== "") // Remove empty lines
    .map((line) => `<li>${line.trim()}</li>`) // Wrap each line in a list item
    .join("");
  summaryElement.innerHTML = `<ul>${formattedText}</ul>`;
}

settingsTab.addEventListener("click", () => {
  settingsTab.classList.toggle("change");
  const tabRect = settingsTab.getBoundingClientRect();

  // Position the panel to align with the tab
  settingsPanel.style.top = `${tabRect.top + window.scrollY}px`;
  // settingsCard.classList.toggle("collapsed");
  const isExpanded = settingsTab.getAttribute("aria-expanded") === "true";
  if (isExpanded) {
    settingsPanel.style.display = "none";
    settingsTab.setAttribute("aria-expanded", "false");
  } else {
    settingsPanel.style.display = "block";
    settingsTab.setAttribute("aria-expanded", "true");
  }
});

// Function to create a new card
function createNewCard(origtext, text) {
  // Create a new div element with the class 'card'
  const newCard = document.createElement("div");
  newCard.classList.add("card");
  // Create a span for the 'selected:' text with a different font
  const selectedText = document.createElement("span");
  selectedText.classList.add("selected-text");
  selectedText.textContent = "selected: ";

  // Create a div or text node for the rest of the content
  const restText = document.createElement("span");
  restText.classList.add("selected-text-2");
  restText.textContent = " " + origtext;

  const newLineText = formatText(text);

  // Append the selected text and the rest of the text to the card
  newCard.appendChild(selectedText);
  newCard.appendChild(restText);
  newCard.appendChild(newLineText); // Add it to the card
  cardContainer.appendChild(newCard);
}
function formatText(text) {
  const container = document.createElement("div");
  container.style.fontFamily = "Arial, sans-serif";
  container.style.lineHeight = "1.6";

  const lines = text.split("\n");
  lines.forEach((line) => {
    if (line.startsWith("*")) {
      // Handle list items
      const ul = container.querySelector("ul") || document.createElement("ul");
      if (!ul.parentNode) container.appendChild(ul);

      const li = document.createElement("li");
      li.innerHTML = line
        .slice(1) // Remove the "*"
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>"); // Bold text
      ul.appendChild(li);
    } else {
      // Handle paragraphs
      const p = document.createElement("p");
      p.innerHTML = line.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>"); // Bold text
      container.appendChild(p);
    }
  });

  return container;
}

// Listen for messages in the side panel (index.js)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "selectedTextFromBackground") {
    const selectedText = message.text;
    // console.log("Received selected text in side panel:", selectedText);

    // Update your side panel here
    // For example, show the text in a DOM element in the side panel
    (async () => {
      try {
        let prompt = "What does " + selectedText + " mean in the article.";
        let replyText = await generateReply(prompt);
        if (languageSelect.value !== "en") {
          replyText = await translateText(replyText, languageSelect.value);
        }
        createNewCard(selectedText, replyText);
        sendResponse({ status: "success", replyText }); // Send a response back if needed
      } catch (error) {
        console.error("Error generating reply:", error);
        sendResponse({ status: "error", error: error.message });
      }
    })();
  }
});

//The following part is for Prompt API

async function initDefaults() {
  if (!("aiOriginTrial" in chrome)) {
    console.log("Error: chrome.aiOriginTrial not supported in this browser");
    return;
  }
  const defaults = await chrome.aiOriginTrial.languageModel.capabilities();
  console.log("Model default:", defaults);
  if (defaults.available !== "readily") {
    showResponse(
      `Model not yet available (current state: "${defaults.available}")`
    );
    return;
  }
}
//Start the model
initDefaults();

let session;

async function runPrompt(prompt, params) {
  try {
    if (!session) {
      session = await chrome.aiOriginTrial.languageModel.create(params);
    }
    return session.prompt(prompt);
  } catch (e) {
    console.log("Prompt failed");
    console.error(e);
    console.log("Prompt:", prompt);
    // Reset session
    reset();
    throw e;
  }
}

async function reset() {
  if (session) {
    session.destroy();
  }
  session = null;
}

async function generateReply(prompt) {
  //showLoading();
  let title = document.title;
  try {
    const params = {
      systemPrompt:
        "You are helping reader to understand article: " + pageContent,
    };
    const response = await runPrompt(prompt, params);
    console.log(response);
    return response;
  } catch (e) {
    console.log(e);
  }
}
