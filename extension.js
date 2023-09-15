import MessageTypes from './modules/MessageTypes.js';
import Utilities from './modules/Utilities.js';

class Extension {
    static get Name() { return "ClickFirst" };

    worker = null;
    tab = null;

    // Inputs
    refreshIntervalInput = document.getElementById("refresh_interval");
    buttonTextInput = document.getElementById("button_text");

    // Controls
    startButton = document.getElementById("start");
    stopButton = document.getElementById("stop");
    inProgressIcon = document.getElementById("in_progress");
    jobCompletedBox = document.getElementById("job_completed");
    setIntervalButtons = Array.from(document.getElementsByClassName("set-interval"));
    get storageName() { return `${Extension.Name}/${new URL(this.tab.url).hostname}` };

    constructor() { this.initialize(); }

    async initialize() {
        this.setInProgress(false);

        this.worker = await navigator.serviceWorker.ready;
        [this.tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        await this.loadConfig();

        // Setup Buttons
        this.startButton.addEventListener("click", this.startWorkerJob.bind(this));
        this.stopButton.addEventListener("click", this.stopWorkerJob.bind(this));
        this.setIntervalButtons.forEach(btn =>
            btn.addEventListener("click", function () { this.refreshIntervalInput.value = btn.dataset.interval; }.bind(this)));

        navigator.serviceWorker.addEventListener("message", this.onMessage.bind(this));
        this.worker.active.postMessage({
            name: MessageTypes.job.getStatus,
            tabId: this.tab.id
        });
    }

    async loadConfig(job) {
        if (!job) {
            let storage = await chrome.storage.sync.get(this.storageName);
            job = storage?.[this.storageName] ?? {};
        }
        if (job.refreshInterval) this.refreshIntervalInput.value = job.refreshInterval;
        if (job.buttonText) this.buttonTextInput.value = job.buttonText;
    }

    async saveConfig(job) {
        await chrome.storage.sync.set({ [this.storageName]: job });
    }

    setInProgress(inProgress, isCompleted) {
        Utilities.setClass(this.startButton, "d-none", inProgress);
        Utilities.setClass(this.stopButton, "d-none", !inProgress);
        Utilities.setClass(this.inProgressIcon, "d-none", !inProgress);
        Utilities.setClass(this.jobCompletedBox, "d-none", !isCompleted);

        this.refreshIntervalInput.disabled = inProgress;
        this.buttonTextInput.disabled = inProgress;
        this.setIntervalButtons.forEach(btn => btn.disabled = inProgress);
    }

    startWorkerJob() {
        let refreshInterval = parseInt(this.refreshIntervalInput.value);
        let buttonText = this.buttonTextInput.value;

        Utilities.setClass(this.refreshIntervalInput, "is-invalid", refreshInterval < 1);
        Utilities.setClass(this.buttonTextInput, "is-invalid", buttonText < 3);
        if (document.getElementsByClassName("is-invalid").length > 0) return;

        let job = { tabId: this.tab.id, refreshInterval, buttonText };
        this.saveConfig(job);
        this.worker.active.postMessage({
            name: MessageTypes.job.start,
            job: job
        });
    }

    stopWorkerJob() {
        this.setInProgress(false);
        this.worker.active.postMessage({
            name: MessageTypes.job.stop,
            tabId: this.tab.id
        });
    }

    onMessage(event) {
        switch (event.data.name) {
            case MessageTypes.job.started: this.jobStarted(event.data.job); break;
            case MessageTypes.job.completed: this.setInProgress(false, true); break;
        }
    }

    async jobStarted(job) {
        this.setInProgress(true);
        await this.loadConfig(job);
    }
}

export default new Extension();
