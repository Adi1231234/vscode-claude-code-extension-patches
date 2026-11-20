/* Lets every other extension's work run before going on: the host is one thread,
   and a chat's files can number tens of thousands. Awaited between slices of a
   long loop. */
globalThis.__ccCFBreathe = globalThis.__ccCFBreathe || function () {
    return new Promise(function (resolve) { setImmediate(resolve); });
};
