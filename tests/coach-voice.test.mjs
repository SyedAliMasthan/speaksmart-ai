import { test } from "node:test";
import assert from "node:assert/strict";
import { playback } from "../src/coach/voice.js";
test("manual interruption settles playback instead of hanging the next turn", async () => {
  class FakeAudio {
    play() {
      return Promise.resolve();
    }
    pause() {}
  }
  const previous = globalThis.Audio;
  globalThis.Audio = FakeAudio;
  try {
    const player = playback("AAAA");
    player.stop();
    player.stop();
    assert.equal(await player.done, "stopped");
  } finally {
    globalThis.Audio = previous;
  }
});
test("autoplay rejection settles with a recoverable state", async () => {
  class BlockedAudio {
    play() {
      return Promise.reject(new Error("NotAllowed"));
    }
    pause() {}
  }
  const previous = globalThis.Audio;
  globalThis.Audio = BlockedAudio;
  try {
    const player = playback("AAAA");
    assert.equal(await player.done, "blocked");
  } finally {
    globalThis.Audio = previous;
  }
});
