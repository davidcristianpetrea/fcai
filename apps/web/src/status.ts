export type ApiState = "loading" | "healthy" | "reserved" | "unavailable";

export async function getApiState(fetcher: () => Promise<Response>): Promise<Exclude<ApiState, "loading">> {
  try {
    const response = await fetcher();
    if (response.status === 501) return "reserved";
    return response.ok ? "healthy" : "unavailable";
  } catch {
    return "unavailable";
  }
}
