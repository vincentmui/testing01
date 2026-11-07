async function request(path, options) {
  const response = await fetch(`/api${path}`, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = typeof body.detail === "string" ? body.detail : body.detail ? JSON.stringify(body.detail) : `Request failed (${response.status})`;
    throw Object.assign(new Error(detail), { status: response.status });
  }
  return body;
}

const json = (method, body) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const health = () => request("/health");
export const getBranding = () => request("/branding");
export const getOpenApi = () => request("/openapi.json");
export const getReport = () => request("/report");
export const getDataSummary = () => request("/data/summary");
export const getEda = () => request("/eda");
export const getModels = () => request("/models");
export const getThreshold = () => request("/threshold");
export const getInsights = () => request("/insights");
export const getBusinessSummary = () => request("/business-summary");
export const getOptions = () => request("/predict/options");
export const predict = (inputs) => request("/predict", json("POST", { inputs }));
export const predictBatch = (file) => {
  const form = new FormData();
  form.append("file", file);
  return request("/predict/batch", { method: "POST", body: form });
};
export const startTraining = () => request("/train", { method: "POST" });
export const getJob = (id) => request(`/jobs/${id}`);

// Poll a training job until it finishes, reporting progress on each tick.
export async function watchJob(jobId, onUpdate) {
  for (;;) {
    const job = await getJob(jobId);
    onUpdate(job);
    if (job.status !== "running") return job;
    await new Promise((r) => setTimeout(r, 1000));
  }
}
