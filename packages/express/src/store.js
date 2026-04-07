import { DEFAULT_MAX_EVENTS } from "./constants.js";

export function createEventStore({ maxEvents = DEFAULT_MAX_EVENTS } = {}) {
  const events = [];

  return {
    add(event) {
      events.push(event);

      if (events.length > maxEvents) {
        events.splice(0, events.length - maxEvents);
      }
    },
    list() {
      return [...events];
    },
    clear() {
      events.length = 0;
    },
  };
}
