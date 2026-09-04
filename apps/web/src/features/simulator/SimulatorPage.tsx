import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button, Callout, Card, FilePicker, TextField } from "../../components/ui";
import { formatBytes } from "../../lib/format";
import { ApiError, toErrorMessage } from "../../services/apiClient";
import { startAnalyzeRun, startSampleRun } from "../../services/jobService";
import { useCity } from "../../state/CityContext";
import { useFleet } from "../../state/FleetContext";

/**
 * Matches `client_max_body_size 200m` in infra/nginx.conf. Checking here turns a
 * confusing production 413 into an explanation before the upload starts.
 */
const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

const GPS_EXTENSIONS = [".csv", ".gpx"];

type Submission =
  | { state: "idle" }
  | { state: "submitting"; label: string }
  | { state: "queued"; jobId: string }
  | { state: "failed"; message: string };

function validateVideo(file: File | null): string | null {
  if (!file) {
    return "Attach a dashcam clip to analyse.";
  }
  if (file.size === 0) {
    return "That file is empty.";
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return `That clip is ${formatBytes(file.size)}. The API accepts up to ${formatBytes(MAX_VIDEO_BYTES)}.`;
  }
  return null;
}

function validateGps(file: File | null): string | null {
  if (!file || file.size === 0) {
    return null; // Optional: the backend substitutes the city sample track.
  }
  const name = file.name.toLowerCase();
  if (!GPS_EXTENSIONS.some((extension) => name.endsWith(extension))) {
    return "The GPS track must be a .csv (t,lat,lng) or .gpx file.";
  }
  return null;
}

export function SimulatorPage() {
  const { city } = useCity();
  const { job } = useFleet();

  const [busId, setBusId] = useState(city.sampleBus);
  const [video, setVideo] = useState<File | null>(null);
  const [gps, setGps] = useState<File | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [submission, setSubmission] = useState<Submission>({ state: "idle" });

  // Switching city changes the demo vehicle, as before.
  useEffect(() => {
    setBusId(city.sampleBus);
  }, [city.sampleBus]);

  const busy = submission.state === "submitting";

  // The feed is authoritative once it starts reporting; the POST response only
  // covers the gap before the first job_progress frame arrives.
  const progress = useMemo(() => {
    if (job) {
      return job;
    }
    if (submission.state === "queued") {
      return {
        id: submission.jobId,
        kind: "analyze",
        status: "queued",
        message: "Queued. Waiting for the analysis worker.",
        progress: 0,
        bus_id: busId,
      };
    }
    return null;
  }, [job, submission, busId]);

  function reportFailure(cause: unknown, fallback: string) {
    const message =
      cause instanceof ApiError && cause.isOffline
        ? "Cannot reach the Drishti API. Check that the backend is running."
        : toErrorMessage(cause, fallback);
    setSubmission({ state: "failed", message });
  }

  async function runSample() {
    setSubmission({ state: "submitting", label: "sample" });
    try {
      const started = await startSampleRun(busId, city.id);
      setSubmission({ state: "queued", jobId: started.id });
    } catch (cause) {
      reportFailure(cause, "The sample run could not be started.");
    }
  }

  async function onUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextVideoError = validateVideo(video);
    const nextGpsError = validateGps(gps);
    setVideoError(nextVideoError);
    setGpsError(nextGpsError);
    if (nextVideoError || nextGpsError || !video) {
      return;
    }

    setSubmission({ state: "submitting", label: "upload" });
    try {
      const started = await startAnalyzeRun({ video, gps, busId, city: city.id });
      setSubmission({ state: "queued", jobId: started.id });
    } catch (cause) {
      reportFailure(cause, "The upload could not be analysed.");
    }
  }

  const jobFailed = progress?.status === "failed";

  return (
    <div className="sim scroll-y">
      <div className="sim__inner">
        <header className="stack-sm">
          <h1>Bus simulator</h1>
          <p className="sim__lede">
            Feed a dashcam clip through the detection pipeline and watch incidents land on the{" "}
            {city.label} map. The GPS track is optional &mdash; without one the API substitutes the
            city sample trail so pins still have a location.
          </p>
        </header>

        {submission.state === "failed" ? (
          <Callout
            tone="error"
            title="Could not start the run"
            onDismiss={() => setSubmission({ state: "idle" })}
          >
            {submission.message}
          </Callout>
        ) : null}

        <div className="sim__grid">
          <Card title="Built-in sample">
            <p className="muted">
              Generates a synthetic route with planted defects, then runs detection on it. No files
              needed.
            </p>
            <TextField
              label="Vehicle ID"
              value={busId}
              onValueChange={setBusId}
              disabled={busy}
              hint="Used as the reporting vehicle for every detection in this run."
            />
            <Button
              variant="primary"
              busy={busy && submission.state === "submitting" && submission.label === "sample"}
              disabled={busy || !busId.trim()}
              onClick={runSample}
            >
              Run sample route
            </Button>
          </Card>

          <Card title="Your dashcam">
            <form className="stack" onSubmit={onUpload}>
              <FilePicker
                label="Dashcam video"
                name="video"
                accept="video/*"
                placeholder="No video selected"
                fileName={video ? `${video.name} (${formatBytes(video.size)})` : ""}
                error={videoError}
                disabled={busy}
                onFileChange={(file) => {
                  setVideo(file);
                  setVideoError(validateVideo(file));
                }}
              />
              <FilePicker
                label="GPS track"
                name="gps"
                accept=".csv,text/csv,.gpx"
                placeholder="Optional — city trail is used if empty"
                fileName={gps ? gps.name : ""}
                error={gpsError}
                disabled={busy}
                hint="CSV columns t,lat,lng where t is seconds from the start of the clip."
                onFileChange={(file) => {
                  setGps(file);
                  setGpsError(validateGps(file));
                }}
              />
              <Button
                type="submit"
                variant="primary"
                busy={busy && submission.state === "submitting" && submission.label === "upload"}
                disabled={busy}
              >
                Analyse upload
              </Button>
            </form>
          </Card>
        </div>

        {progress ? (
          <Card title="Analysis job">
            <div
              className="progress"
              role="progressbar"
              aria-valuenow={progress.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Analysis progress"
            >
              <span className="progress__bar" style={{ width: `${progress.progress}%` }} />
            </div>
            <p className="job-note" aria-live="polite">
              {progress.status} &middot; {progress.progress}% &middot; {progress.message}
            </p>
            {jobFailed ? (
              <Callout tone="error" title="The analysis job failed">
                {progress.message || "The backend reported a failure without a message."}
              </Callout>
            ) : null}
            {progress.status === "done" ? (
              <Callout tone="info">
                Detections were clustered into incidents. Open the map to review them.
              </Callout>
            ) : null}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
