"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowUpRight, Columns2, ImagePlus, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

export type GalleryReference = {
  id: string;
  title?: string;
  creator?: string;
  country?: string;
  provider: string;
  sourceUrl: string;
  sourceLocation?: string;
  year?: number | null;
  rank?: number | null;
  designLesson?: string;
  compositionTags?: string[];
  plantNames?: string[];
};

type DisplayReference = GalleryReference & { preview?: string; dimensions?: string };
type LocalPhoto = { url: string; name: string };
const PAGE_SIZE = 24;
const originals: DisplayReference[] = [
  { id: "fishy-original-hero-60-arch", title: "The river arch", creator: "Fishy", provider: "Fishy originals", sourceUrl: "", preview: "/showcase/hero-60-arch.png", dimensions: "60 × 30 × 36 cm", designLesson: "A wood arch over an open sand foreground." },
  { id: "fishy-original-panorama-90-angular", title: "Long horizon", creator: "Fishy", provider: "Fishy originals", sourceUrl: "", preview: "/showcase/panorama-90-angular.png", dimensions: "90 × 30 × 30 cm", designLesson: "Angular wood in a shallow panorama." },
  { id: "fishy-original-cube-45-stump", title: "Forest island", creator: "Fishy", provider: "Fishy originals", sourceUrl: "", preview: "/showcase/cube-45-stump.png", dimensions: "45 × 45 × 45 cm", designLesson: "A rooted composition in a cube." },
];

const studyPrompts = [
  ["Composition & planting", "Compare the focal point, open space, and balance of planting."],
  ["Natural atmosphere", "Look at how wood, stone, and planting connect across the scene."],
  ["Originality & impression", "Choose an idea to adapt to your own layout."],
  ["Maintenance access", "Check whether there is room to trim, clean, and reach behind the hardscape."],
];

function titleOf(entry: GalleryReference) {
  return entry.title || `${entry.provider} ${entry.year ?? ""} · Rank ${entry.rank ?? "—"}`;
}

function SourceLink({ entry }: { entry: GalleryReference }) {
  // Only curated source-page domains, never a scraped image URL or arbitrary URL scheme.
  let allowed = false;
  try {
    const url = new URL(entry.sourceUrl);
    allowed = url.protocol === "https:" && !url.username && !url.password &&
      ["iaplc.com"].includes(url.hostname) &&
      !/\/image\/|\/wp-content\/|\.(jpe?g|png|webp|svg)(?:$|\?)/i.test(url.pathname);
  } catch { /* Source is optional for an original or session photo. */ }
  return allowed ? <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer">Open {entry.provider}<ArrowUpRight size={15} /></a> : null;
}

function ReferenceImage({ src, alt, onUnavailable }: { src: string; alt: string; onUnavailable?: () => void }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  if (failed) return <div className="gallery-image-failure" role="status">Image unavailable. Choose another reference.</div>;
  return <div className={`gallery-image ${loaded ? "is-loaded" : ""}`} aria-busy={!loaded}>
    {!loaded && <div className="gallery-image-loader" aria-hidden="true" />}
    <img src={src} alt={alt} loading="lazy" decoding="async" onLoad={() => setLoaded(true)} onError={() => { if (onUnavailable) onUnavailable(); else setFailed(true); }} />
  </div>;
}

function GalleryLoadingScreen() {
  return <div className="gallery-loading" role="status" aria-live="polite">
    <div className="gallery-loading-copy"><span className="gallery-loading-orbit" aria-hidden="true" /><div><h3>Curating aquascapes</h3><p>Preparing image-rich references for your next layout.</p></div></div>
    <div className="gallery-loading-grid" aria-hidden="true">{Array.from({ length: 6 }, (_, index) => <div className="gallery-loading-card" key={index}><Skeleton className="gallery-loading-image" /><Skeleton className="gallery-loading-line gallery-loading-line-title" /><Skeleton className="gallery-loading-line" /></div>)}</div>
  </div>;
}

export function GalleryWorkspace({ entries, savedIds, onSave, creation }: {
  entries: GalleryReference[];
  savedIds: string[];
  onSave: (id: string) => void;
  creation: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState("all");
  const [year, setYear] = useState("all");
  const [rank, setRank] = useState("all");
  const [savedOnly, setSavedOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<DisplayReference | null>(null);
  const [creationPhoto, setCreationPhoto] = useState<LocalPhoto | null>(null);
  const [referencePhoto, setReferencePhoto] = useState<LocalPhoto | null>(null);
  const [error, setError] = useState("");
  const [loadingPhoto, setLoadingPhoto] = useState<"creation" | "reference" | null>(null);
  const [iaplcImages, setIaplcImages] = useState<Record<string, string>>({});
  const [iaplcImagesState, setIaplcImagesState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [unavailablePreviews, setUnavailablePreviews] = useState<Set<string>>(() => new Set());
  const urls = useRef(new Set<string>());
  const alive = useRef(true);
  const uploadBusy = useRef(false);
  const uploadVersion = useRef(0);
  const galleryHeading = useRef<HTMLHeadingElement>(null);
  const comparisonHeading = useRef<HTMLHeadingElement>(null);
  const lastComparisonButton = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    alive.current = true;
    const owned = urls.current;
    return () => { alive.current = false; uploadVersion.current++; owned.forEach(url => URL.revokeObjectURL(url)); owned.clear(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const startedAt = performance.now();
    let releaseTimer: number | undefined;
    let disposed = false;
    const settle = (state: "ready" | "unavailable") => {
      const remaining = Math.max(0, 480 - (performance.now() - startedAt));
      releaseTimer = window.setTimeout(() => { if (!disposed) setIaplcImagesState(state); }, remaining);
    };
    fetch("/data/iaplc-images.json", { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error("IAPLC photographs are temporarily unavailable.");
        return response.json() as Promise<{ images?: unknown }>;
      })
      .then(payload => {
        if (!payload.images || typeof payload.images !== "object" || Array.isArray(payload.images)) throw new Error("Invalid IAPLC photograph index.");
        setIaplcImages(payload.images as Record<string, string>);
        settle("ready");
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        settle("unavailable");
      });
    return () => { disposed = true; controller.abort(); if (releaseTimer) window.clearTimeout(releaseTimer); };
  }, []);

  const allEntries = useMemo<DisplayReference[]>(() => [
    ...originals,
    ...entries.flatMap(entry => {
      const preview = entry.provider === "IAPLC" ? iaplcImages[entry.id] : undefined;
      return typeof preview === "string" && preview ? [{ ...entry, preview }] : [];
    }),
  ].filter(entry => !unavailablePreviews.has(entry.id)), [entries, iaplcImages, unavailablePreviews]);
  const providers = useMemo(() => [...new Set(allEntries.map(entry => entry.provider))], [allEntries]);
  const years = useMemo(() => [...new Set(allEntries.map(entry => entry.year).filter((y): y is number => typeof y === "number"))].sort((a, b) => b - a), [allEntries]);
  const filtered = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return allEntries.filter(entry => {
      if (provider !== "all" && entry.provider !== provider) return false;
      if (year !== "all" && entry.year !== Number(year)) return false;
      if (rank !== "all" && (entry.rank == null || entry.rank > Number(rank))) return false;
      if (savedOnly && !savedIds.includes(entry.id)) return false;
      const text = [entry.title, entry.creator, entry.country, entry.provider, entry.year, entry.rank, entry.sourceLocation, ...(entry.compositionTags ?? [])].join(" ").toLocaleLowerCase();
      return terms.every(term => text.includes(term));
    });
  }, [allEntries, query, provider, year, rank, savedOnly, savedIds]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const comparing = selected !== null;

  const removePhoto = (side: "creation" | "reference") => {
    const photo = side === "creation" ? creationPhoto : referencePhoto;
    if (photo) { URL.revokeObjectURL(photo.url); urls.current.delete(photo.url); }
    if (side === "creation") setCreationPhoto(null); else setReferencePhoto(null);
  };

  const attach = async (file: File, side: "creation" | "reference") => {
    if (uploadBusy.current) return;
    uploadBusy.current = true;
    const version = ++uploadVersion.current;
    setLoadingPhoto(side);
    setError("");
    try {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Choose a JPEG, PNG, or WebP photo.");
      if (file.size > 10 * 1024 * 1024) throw new Error("Choose a photo smaller than 10 MB.");
      const bitmap = await createImageBitmap(file);
      const pixels = bitmap.width * bitmap.height;
      bitmap.close();
      if (pixels > 24_000_000) throw new Error("Choose a photo under 24 megapixels.");
      if (!alive.current || version !== uploadVersion.current) return;
      const photo = { url: URL.createObjectURL(file), name: file.name };
      removePhoto(side);
      urls.current.add(photo.url);
      if (side === "creation") setCreationPhoto(photo);
      else {
        setReferencePhoto(photo);
        setSelected({ id: "session-reference-photo", title: file.name, creator: "Your reference photo", provider: "Your photos", sourceUrl: "" });
        requestAnimationFrame(() => comparisonHeading.current?.focus());
      }
    } catch (err) {
      if (alive.current && version === uploadVersion.current) setError(err instanceof Error ? err.message : "That image could not be opened. Try another photo.");
    } finally {
      uploadBusy.current = false;
      if (alive.current) setLoadingPhoto(null);
    }
  };

  const photoInput = (side: "creation" | "reference", label: string) => <Button asChild variant="outline" size="sm" className="gallery-photo-input">
    <label>
      <ImagePlus size={16} /><span>{loadingPhoto === side ? "Opening photo…" : label}</span>
      <input type="file" aria-label={label} accept="image/jpeg,image/png,image/webp" disabled={loadingPhoto !== null} onChange={event => {
        const file = event.target.files?.[0]; event.target.value = "";
        if (file) void attach(file, side);
      }} />
    </label>
  </Button>;

  const compare = (entry: DisplayReference, button: HTMLButtonElement) => {
    uploadVersion.current++;
    lastComparisonButton.current = button;
    setSelected(entry);
    setError("");
    requestAnimationFrame(() => comparisonHeading.current?.focus());
  };
  const back = () => {
    uploadVersion.current++;
    setSelected(null);
    setError("");
    requestAnimationFrame(() => {
      if (lastComparisonButton.current?.isConnected) lastComparisonButton.current.focus();
      else galleryHeading.current?.focus();
    });
  };
  const saveButton = (entry: GalleryReference) => {
    if (entry.provider === "Your photos" || entry.provider === "Fishy originals") return null;
    const saved = savedIds.includes(entry.id);
    return <Button variant="outline" size="sm" disabled={saved || savedIds.length >= 50} title={savedIds.length >= 50 && !saved ? "50 saved ideas reached. Remove one in Ideas to save another." : undefined} onClick={() => onSave(entry.id)}>{saved ? "Saved to ideas" : "Save idea"}</Button>;
  };
  const selectedPhoto = selected?.provider === "Your photos" ? referencePhoto?.url : selected?.preview;
  const markPreviewUnavailable = (id: string) => setUnavailablePreviews(current => current.has(id) ? current : new Set([...current, id]));

  return <section className="gallery-workspace" aria-label="Reference gallery">
    {error && <div className="gallery-error" role="alert"><span>{error}</span><Button variant="ghost" size="icon-sm" aria-label="Dismiss photo error" onClick={() => setError("")}><X size={16} /></Button></div>}
    <div className="gallery-browse" hidden={comparing}>
      <header className="gallery-header">
        <div><h2 ref={galleryHeading} tabIndex={-1}>Gallery</h2><p>Find a reference. Compare it with your creation.</p></div>
        <div>{photoInput("reference", "Compare my reference photo")}</div>
      </header>
      <div className="gallery-filters">
        <label className="gallery-search"><Search size={18} /><input aria-label="Search gallery" placeholder="Creator, country, title, or year" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} /></label>
        <label>Source<select aria-label="Gallery source" value={provider} onChange={e => { setProvider(e.target.value); setPage(0); }}><option value="all">All sources</option>{providers.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Year<select aria-label="Gallery year" value={year} onChange={e => { setYear(e.target.value); setPage(0); }}><option value="all">All years</option>{years.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Rank<select aria-label="Gallery rank" value={rank} onChange={e => { setRank(e.target.value); setPage(0); }}><option value="all">All ranks</option><option value="1">Grand prize</option><option value="10">Top 10</option><option value="60">Top 60</option><option value="100">Top 100</option></select></label>
        <label className="gallery-saved-filter"><input type="checkbox" checked={savedOnly} onChange={e => { setSavedOnly(e.target.checked); setPage(0); }} />Saved ideas</label>
      </div>
      <div className="gallery-results-heading">{iaplcImagesState === "loading" ? <span role="status">Preparing preview cards</span> : <span role="status">{filtered.length.toLocaleString()} references</span>}</div>
      {iaplcImagesState === "loading" ? <GalleryLoadingScreen /> : filtered.length ? <div className="gallery-grid">{filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map((entry, index) => <Card role="article" className="gallery-card" key={entry.id} style={{ animationDelay: `${80 + Math.min(index, 8) * 48}ms` }}>
        <div className="gallery-thumbnail"><ReferenceImage key={entry.preview} src={entry.preview!} alt={entry.provider === "IAPLC" ? `${titleOf(entry)} by ${entry.creator || "entrant not listed"}` : `${entry.title}, original Fishy render`} onUnavailable={() => markPreviewUnavailable(entry.id)} /></div>
        <CardContent className="gallery-card-body">
          <div className="gallery-card-meta"><span>{entry.provider}</span><span>{entry.year ?? entry.dimensions ?? "Layout study"}</span></div>
          {entry.rank != null && <Badge className="gallery-rank" variant="secondary">{entry.rank === 1 ? "Grand prize" : `World rank ${String(entry.rank).padStart(3, "0")}`}</Badge>}
          <h3>{titleOf(entry)}</h3><p>{entry.creator || "Entrant not listed"}{entry.country ? ` · ${entry.country}` : ""}</p>
          {entry.designLesson && <p className="gallery-lesson">{entry.designLesson}</p>}
          <div className="gallery-card-actions"><Button variant="secondary" size="sm" className="gallery-compare-button" onClick={e => compare(entry, e.currentTarget)} aria-label={`Compare with ${titleOf(entry)}`}><Columns2 size={15} />Compare</Button>{saveButton(entry)}<SourceLink entry={entry} /></div>
        </CardContent>
      </Card>)}</div> : <Empty className="gallery-empty"><EmptyHeader><EmptyTitle>No matching references</EmptyTitle><EmptyDescription>Try a different creator, year, or source.</EmptyDescription></EmptyHeader><EmptyContent><Button variant="outline" onClick={() => { setQuery(""); setProvider("all"); setYear("all"); setRank("all"); setSavedOnly(false); setPage(0); }}>Clear filters</Button></EmptyContent></Empty>}
      {iaplcImagesState !== "loading" && <nav className="gallery-pagination" aria-label="Gallery pages"><Button variant="outline" size="sm" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button><span>Page {currentPage + 1} of {pages}</span><Button variant="outline" size="sm" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next</Button></nav>}
    </div>
    {selected && <div className="gallery-comparison">
      <header className="gallery-comparison-header"><Button variant="outline" size="sm" onClick={back}><ArrowLeft size={16} />Gallery</Button><h2 ref={comparisonHeading} tabIndex={-1}>Side by side</h2>{saveButton(selected)}</header>
      <div className="gallery-compare-grid">
        <Card className="gallery-compare-pane" aria-label="Your creation">
          <header><div><h3>Your creation</h3><p>{creationPhoto ? creationPhoto.name : "Current scene · orbit to inspect"}</p></div>{creationPhoto ? <Button variant="outline" size="sm" onClick={() => removePhoto("creation")}>Use current scene</Button> : photoInput("creation", "Use my tank photo")}</header>
          <div className="gallery-creation-visual">{creationPhoto ? <ReferenceImage key={creationPhoto.url} src={creationPhoto.url} alt={`Your creation: ${creationPhoto.name}`} /> : creation}</div>
          <p className="gallery-pane-note">{creationPhoto ? "Your photo is only available in this session." : "Scene changes carry over from the editor."}</p>
        </Card>
        <Card className="gallery-compare-pane" aria-label="Selected reference">
          <header><div><h3>{titleOf(selected)}</h3><p>{selected.creator || "Entrant not listed"}{selected.country ? ` · ${selected.country}` : ""}{selected.year ? ` · ${selected.year}` : ""}{selected.rank ? ` · Rank ${selected.rank}` : ""}</p></div>{selected.provider === "Your photos" && <Button variant="outline" size="sm" onClick={() => { removePhoto("reference"); back(); }}>Remove photo</Button>}</header>
          <div className={`gallery-reference-visual ${selectedPhoto ? "" : "gallery-source-only"}`}>
            {selectedPhoto ? <ReferenceImage key={selectedPhoto} src={selectedPhoto} alt={selected.provider === "Your photos" ? `Your reference photo: ${selected.title}` : selected.provider === "IAPLC" ? `${titleOf(selected)} by ${selected.creator || "entrant not listed"}` : `${selected.title}, original Fishy render`} /> : <div><span className="gallery-source-label">{selected.provider} reference</span><h3>View the photograph at its source</h3><p>{selected.sourceLocation ?? "Open the source page to see this layout."}</p><SourceLink entry={selected} /><p className="gallery-source-note">This reference links to its publisher; its photograph is not available in Fishy.</p></div>}
          </div>
          <div className="gallery-pane-note"><span>{selected.provider === "Fishy originals" ? `Original Fishy render · ${selected.dimensions}` : selected.provider === "Your photos" ? "Your reference photo · this session only" : selected.provider === "IAPLC" && selectedPhoto ? "IAPLC entry photograph · displayed with permission" : "Source metadata; tank dimensions and species are not inferred."}</span>{selected.provider !== "Your photos" && photoInput("reference", "Use my own reference photo")}</div>
        </Card>
      </div>
      <details className="gallery-study-guide"><summary>What to compare</summary><div className="gallery-study-grid">{studyPrompts.map(([heading, text]) => <div key={heading}><h3>{heading}</h3><p>{text}</p></div>)}</div><p>Fishy study prompts adapted from the <a href="https://iaplc.com/e/judging_criteria/" target="_blank" rel="noopener noreferrer">IAPLC judging criteria</a>. These are prompts for composition review, not contest scores or fish-health assessments.</p></details>
      <details className="gallery-photo-guide"><summary>Tips for comparison photos</summary><p>Photograph the whole tank straight from the front, keep the camera level, and avoid cropping. Aim for at least 1,500 pixels wide. Choose a photo you own or have permission to use. JPEG, PNG, or WebP; up to 10 MB and 24 megapixels. Nothing is uploaded or included in a saved scene.</p></details>
    </div>}
  </section>;
}
