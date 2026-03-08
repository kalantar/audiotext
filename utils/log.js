// Shared timestamped logging helper.
// tsLog: dev-only, prepends [HH:MM:SS.mmm] [TAG] for correlation with UI events.
// Uses typeof guard so it works in Node.js environments where __DEV__ is not defined.
export const tsLog = (tag, ...args) => {
  if (typeof __DEV__ !== 'undefined' ? __DEV__ : false) {
    const now = new Date();
    const ts = now.toTimeString().slice(0, 8) + '.' + String(now.getMilliseconds()).padStart(3, '0');
    console.log(`[${ts}] [${tag}]`, ...args);
  }
};
