import { afterEach, describe, expect, it, vi } from "vitest";
import { validateBackendEndpoints } from "~/lib/utils/validateBackend";

const widgets = {
  first: { type: "table", endpoint: "/first", params: [] },
  second: { type: "table", endpoint: "/second", params: [] },
  third: { type: "table", endpoint: "/third", params: [] },
} as any;

afterEach(() => vi.unstubAllGlobals());

describe("backend validation cancellation", () => {
  it("does not request widgets after the shared signal aborts", async () => {
    const controller = new AbortController();
    const fetch = vi.fn().mockImplementation(async () => {
      controller.abort(new DOMException("signal timed out", "TimeoutError"));
      throw controller.signal.reason;
    });
    vi.stubGlobal("fetch", fetch);
    await expect(
      validateBackendEndpoints(
        widgets,
        new URL("https://example.com"),
        {},
        false,
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: "TimeoutError" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not start requests for an already cancelled validation", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(
      validateBackendEndpoints(
        widgets,
        new URL("https://example.com"),
        {},
        false,
        controller.signal,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("continues after an ordinary endpoint failure", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Unavailable" }), { status: 503 }),
      )
      .mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetch);
    const failures = await validateBackendEndpoints(
      widgets,
      new URL("https://example.com"),
      {},
    );
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(failures).toEqual(['Widget: first - "Unavailable"']);
  });
});
