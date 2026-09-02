import { FormEvent, useEffect, useState } from "react";
import { startAnalyze, startSample } from "../api";
import type { City } from "../cities";
import type { Job } from "../types";

type Props = {
  job: Job | null;
  city: City;
};

export function Simulator({ job, city }: Props) {
  const [busId, setBusId] = useState(city.sampleBus);
  const [videoName, setVideoName] = useState("");
  const [gpsName, setGpsName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBusId(city.sampleBus);
  }, [city.sampleBus]);

  async function runSample() {
    setBusy(true);
    setError("");
    try {
      await startSample(busId, city.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sample job failed");
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const video = form.get("video");
    const gps = form.get("gps");
    if (!(video instanceof File) || !video.size) {
      setError("Attach a dashcam video first.");
      return;
    }
    const gpsFile = gps instanceof File && gps.size ? gps : null;
    setBusy(true);
    setError("");
    try {
      await startAnalyze(video, gpsFile, busId, city.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analyze failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sim">
      <h1>Bus simulator</h1>
      <p className="sim-lead">
        Upload a dashcam clip to run detection on the {city.label} map. GPS is optional — if you skip
        it, the city sample trail is used so pins still land on the map.
      </p>
      <div className="sim-grid">
        <div className="card">
          <strong>Built-in sample</strong>
          <label className="field">
            Bus ID
            <input value={busId} onChange={(e) => setBusId(e.target.value)} />
          </label>
          <button className="primary" type="button" disabled={busy} onClick={runSample}>
            {busy ? "Starting…" : "Run sample route"}
          </button>
        </div>
        <form className="card" onSubmit={onUpload}>
          <strong>Your dashcam</strong>
          <label className="file-pick">
            <input
              name="video"
              type="file"
              accept="video/*"
              onChange={(e) => setVideoName(e.target.files?.[0]?.name || "")}
            />
            <span className="file-pick-btn">Choose video</span>
            <span className="file-pick-name">{videoName || "No video selected"}</span>
          </label>
          <label className="file-pick">
            <input
              name="gps"
              type="file"
              accept=".csv,text/csv,.gpx"
              onChange={(e) => setGpsName(e.target.files?.[0]?.name || "")}
            />
            <span className="file-pick-btn">Choose GPS</span>
            <span className="file-pick-name">{gpsName || "Optional — city trail if empty"}</span>
          </label>
          <button className="primary" type="submit" disabled={busy}>
            Analyze upload
          </button>
        </form>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {job ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="progress">
            <span style={{ width: `${job.progress}%` }} />
          </div>
          <div className="job-note">
            {job.status} · {job.progress}% · {job.message}
          </div>
        </div>
      ) : null}
    </div>
  );
}
