import { NotionClient, validateNotionToken } from './data/notion-client.mjs';
import { createReadRepository } from './data/read-repository.mjs';
import { createConnectionFile } from './platform/connection-file.mjs';
import { createSubmissionState } from './state/submission-state.mjs';
import { createCommands } from './commands/index.mjs';
import { createAppLifecycle } from './platform/app-lifecycle.mjs';
import { createAppController } from './ui/controller.mjs';
import { createAppView } from './ui/view.mjs';

const registrationPromise = 'serviceWorker' in navigator
  ? navigator.serviceWorker.register(new URL('./sw.js', import.meta.url)).catch(() => undefined)
  : undefined;
const view = createAppView(document, { validateToken: validateNotionToken });
const state = createSubmissionState();
const file = createConnectionFile();
let lifecycle;
const app = createAppController({
  view, state, file, onStateChange: () => lifecycle?.notifyStateChange(),
  makeClient: connection => new NotionClient(connection.token, { dataSources: connection.dataSources, connectionRevision: connection.revision }),
  makeRepository: client => createReadRepository(client),
  makeCommands: ({ client, repository, submissionState }) => createCommands({ client, repository, submissionState }),
});
app.bind();
if (navigator.serviceWorker) {
  lifecycle = createAppLifecycle({ getState: app.getState, setFrozen: app.setFrozen, submissionState: state, serviceWorker: navigator.serviceWorker });
  void registrationPromise.then(registration => lifecycle.start(registration));
}
void app.initialize();
