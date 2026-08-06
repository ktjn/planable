export function fireAndForget(promise: Promise<unknown>): void {
  promise.catch((err) => {
    console.error(err);
  });
}
