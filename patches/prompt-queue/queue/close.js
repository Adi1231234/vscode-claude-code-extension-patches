  /* What queue/lanes.js needs of a queue: take down what it drew when its lane
     leaves the screen, look again when it comes back, and the conversation it
     reads now - an agent's lane is kept under its conversation's id. */
  return { detach: detachUi, pass: schedulePass, sid: getSessionId };
};
