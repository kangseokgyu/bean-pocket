// Each form keeps one key for its last complete request payload.
// Read the actual payload at submit time, including all repeated step fields.
export function createSubmissionKeys() {
  let previousPayload = null;
  let previousKey = null;
  return {
    forPayload(payload) {
      const serialized = JSON.stringify(payload);
      if (serialized !== previousPayload) {
        previousPayload = serialized;
        previousKey = crypto.randomUUID();
      }
      return previousKey;
    },
  };
}
