import MessageTypes from './modules/MessageTypes.js';

class ServiceWorker {
    jobs = {};

    constructor() {
        self.addEventListener("message", this.onMessage.bind(this));
        chrome.tabs.onRemoved.addListener(this.stopTabWorker.bind(this))
    }

    onMessage(event) {
        switch (event.data.name) {
            case MessageTypes.job.start: this.startTabWorker(event.data.job, event.source); break;
            case MessageTypes.job.stop: this.stopTabWorker(event.data.tabId); break;
            case MessageTypes.job.getStatus: this.getStatus(event.data.tabId, event.source); break;
        }
    }

    async startTabWorker(job, eventSource) {
        console.log("Job started", job);
        let tabId = job.tabId;
        this.jobs[job.tabId] = job;
        let result;
        eventSource.postMessage({ name: MessageTypes.job.started, job });

        while (this.jobs[tabId] == job) {
            await this.reloadTab(tabId);
            result = await this.clickButtonOnTab(job);
            console.log("Refreshed Tab:", job, "Result:", result);
            if (result.isCompleted) {
                delete this.jobs[tabId];
                eventSource.postMessage({ name: MessageTypes.job.completed });
                break;
            }

            await new Promise(r => setTimeout(r, job.refreshInterval * 1000));
        }
    }

    async reloadTab(tabId) {
        await chrome.tabs.reload(tabId);
        return new Promise(resolve => {
            let listener = function (id, changeInfo) {
                if (id == tabId && changeInfo.status == 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);
                    resolve();
                }
            };

            chrome.tabs.onUpdated.addListener(listener);
        });
    }

    async clickButtonOnTab(job) {
        function injectedCode(buttonText) {
            let regex = RegExp(buttonText, "i");
            let buttons = document.querySelectorAll("a, button, input[type=submit]");
            let matchingButtons = Array.from(buttons).filter(el => el.innerText.match(regex));
            let isCompleted = matchingButtons.length === 1;
            if (isCompleted)
                matchingButtons[0].click();

            return {
                buttonsCount: buttons.length,
                matchingButtonsCount: matchingButtons.length,
                isCompleted
            };
        };

        let [injectionResult] = await chrome.scripting.executeScript({
            target: { tabId: job.tabId },
            func: injectedCode,
            args: [job.buttonText],
        });

        return { ...injectionResult.result };
    }

    stopTabWorker(tabId) {
        let job = this.jobs[tabId];
        if (!job) return;

        delete this.jobs[tabId];
        console.log("Job stopped", tabId);
    }

    getStatus(tabId, eventSource) {
        console.log("Get status", tabId)
        let job = this.jobs[tabId];
        if (job)
            eventSource.postMessage({ name: MessageTypes.job.started, job })
    }
}

export default new ServiceWorker();
