"""Native Fishy sidebar for user-triggered Astra recipe generation.

Registration never starts a model call. Each Generate click launches the local
runner once, using the user's existing Codex login. The current .blend remains
open; Open Result explicitly launches a separate Blender process.
"""

import json
import hashlib
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import textwrap
import time
import uuid
from types import SimpleNamespace

import bpy
from bpy.props import EnumProperty, FloatProperty, StringProperty


ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
import native_snapshot
RUN_ROOT = ROOT / "runs"
STATE_KEY = "_fishy_generation_state_v1"
STATE_MODULE = "_fishy_generation_runtime_v1"
MAX_IMAGE_BYTES = 20 * 1024 * 1024
DEFAULT_BRIEF = "Approximate the visible hardscape and plant groups, preserving open space."


def generation_state():
    # A private Python singleton also survives a .blend load, which can clear
    # driver_namespace. Re-running the script reuses the same Popen and timer.
    singleton = sys.modules.get(STATE_MODULE)
    if singleton is None:
        singleton = SimpleNamespace(state={
            "process": None,
            "timer": None,
            "header_draw": None,
            "log_path": "",
            "run_dir": "",
            "result_file": "",
            "status": "Ready",
            "error": "",
            "started_at": None,
            "elapsed_seconds": 0,
            "snapshot_state_hash": None,
            "snapshot_scene_id": None,
        })
        sys.modules[STATE_MODULE] = singleton
    bpy.app.driver_namespace[STATE_KEY] = singleton.state
    return singleton.state


def is_running(state=None):
    state = state if state is not None else generation_state()
    process = state.get("process")
    return process is not None and process.poll() is None


def child_environment():
    environment = os.environ.copy()
    # App launches on macOS may omit the shell's user binary directories.
    # This modifies only this child's environment, never Blender preferences.
    directories = [str(Path.home() / ".local/bin"), "/opt/homebrew/bin", "/usr/local/bin"]
    existing = environment.get("PATH", os.defpath)
    environment["PATH"] = os.pathsep.join([*directories, existing])
    return environment


def generation_command(python_binary, image, brief, tank_cm, substrate_cm, blender_binary, reference_view="overview"):
    """Build an argv list; image paths and user text are never shell code."""
    image_path = Path(image).expanduser().resolve()
    if not image_path.is_file() or not 0 < image_path.stat().st_size <= MAX_IMAGE_BYTES:
        raise ValueError("Select an existing reference image no larger than 20 MiB.")
    if image_path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}:
        raise ValueError("Select a PNG, JPEG, or WebP reference image.")
    if not isinstance(brief, str) or not brief.strip() or len(brief) > 4000:
        raise ValueError("Enter a design brief of 1–4,000 characters.")
    if len(tank_cm) != 3 or any(not math.isfinite(value) or not 10 <= value <= 300 for value in tank_cm):
        raise ValueError("Tank width, depth, and height must be between 10 and 300 cm.")
    if not math.isfinite(substrate_cm) or not 0 <= substrate_cm <= min(20, tank_cm[2] * 0.3):
        raise ValueError("Substrate must be at most 20 cm and 30% of tank height.")
    if not (ROOT / "generate_scene.py").is_file():
        raise ValueError("The local generation runner is missing.")
    if reference_view not in ("front", "left", "right", "top", "overview", "close_up"):
        raise ValueError("Choose a declared reference view.")
    return [
        str(python_binary), str(ROOT / "generate_scene.py"), "generate",
        "--image", str(image_path), "--brief", brief,
        "--tank-cm", *(format(value, ".9g") for value in tank_cm),
        "--substrate-cm", format(substrate_cm, ".9g"),
        "--dimensions-source", "assumed", "--backend", "codex",
        "--frontier", "--image-view", reference_view,
        "--blender", str(blender_binary), "--run-root", str(RUN_ROOT),
    ]


def redraw_viewports():
    manager = bpy.context.window_manager
    if manager is None:
        return
    for window in manager.windows:
        for area in window.screen.areas:
            if area.type == "VIEW_3D":
                area.tag_redraw()


def draw_tool_header(self, context):
    self.layout.separator(factor=1.5)
    if hasattr(bpy.types, "FISHY_PT_viewport"):
        self.layout.popover(panel="FISHY_PT_viewport", text="Tank Tools", icon="MODIFIER")
    self.layout.popover(panel="FISHY_PT_generation", text="Astra Design", icon="FILE_IMAGE")


def read_run_manifest(state):
    if not state.get("run_dir") and state.get("log_path"):
        try:
            with open(state["log_path"], "r", encoding="utf-8", errors="replace") as handle:
                output = handle.read(64 * 1024)
            for line in output.splitlines():
                if line.startswith("RUN_DIR="):
                    candidate = Path(line[len("RUN_DIR="):]).resolve()
                    if candidate.is_relative_to(RUN_ROOT.resolve()):
                        state["run_dir"] = str(candidate)
                        break
        except OSError:
            pass
    if not state.get("run_dir"):
        return None
    try:
        manifest_path = Path(state["run_dir"]) / "manifest.json"
        if manifest_path.stat().st_size > 256 * 1024:
            return None
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        return manifest if isinstance(manifest, dict) else None
    except (OSError, ValueError):
        # The runner replaces its small manifest while changing stages; retry
        # an incomplete read on the next timer tick without blocking Blender.
        return None


def error_summary(manifest):
    """Explain stages without copying user text, image paths, or raw logs."""
    message = str((manifest or {}).get("error", "")).lower()
    if "timed out" in message or "exceeded" in message:
        return "The run timed out. No automatic retry was made."
    if "codex cli is unavailable" in message:
        return "Codex CLI was unavailable to the runner. Check the local installation."
    if "astra generation failed" in message:
        return "Astra did not complete. Check Codex sign-in and the run's model logs."
    if "blender" in message:
        return "Blender could not complete the scene. Inspect this run's blender.log."
    if "recipe" in message or "model-output" in message:
        return "Astra's recipe did not pass validation. No replacement scene was invented."
    if "image" in message:
        return "The reference image could not be accepted. Choose a valid PNG, JPEG, or WebP."
    return "Generation did not finish. Inspect the run or temporary log for details."


def completed_scene_path(state, manifest):
    if not manifest or manifest.get("status") != "complete" or not state.get("run_dir"):
        return None
    outputs = manifest.get("outputs")
    relative = outputs.get("scene") if isinstance(outputs, dict) else None
    if not isinstance(relative, str) or Path(relative).is_absolute():
        return None
    run_dir = Path(state["run_dir"]).resolve()
    candidate = (run_dir / relative).resolve()
    if candidate.is_relative_to(run_dir) and candidate.suffix == ".blend" and candidate.is_file():
        return candidate
    return None


def seed_from_current_scene(scene):
    """Populate unset form fields from this .blend; preserve user edits on reload."""
    for property_name, scene_key, minimum, maximum in (
        ("fishy_generation_width_cm", "fishy_width_m", 10, 300),
        ("fishy_generation_depth_cm", "fishy_depth_m", 10, 300),
        ("fishy_generation_height_cm", "fishy_height_m", 10, 300),
        ("fishy_generation_substrate_cm", "fishy_substrate_depth_m", 0, 20),
    ):
        if scene.is_property_set(property_name) or scene_key not in scene:
            continue
        value = scene.get(scene_key)
        if isinstance(value, (int, float)) and math.isfinite(value) and minimum <= value * 100 <= maximum:
            setattr(scene, property_name, value * 100)
    if scene.is_property_set("fishy_generation_image") or not bpy.data.filepath:
        return
    current_blend = Path(bpy.data.filepath).resolve()
    run_dir = current_blend.parent
    manifest_path = run_dir / "manifest.json"
    try:
        if not manifest_path.is_file() or manifest_path.stat().st_size > 256 * 1024:
            return
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if not isinstance(manifest, dict) or manifest.get("status") != "complete":
            return
        outputs = manifest.get("outputs")
        relative_scene = outputs.get("scene") if isinstance(outputs, dict) else None
        if not isinstance(relative_scene, str) or Path(relative_scene).is_absolute():
            return
        if (run_dir / relative_scene).resolve() != current_blend:
            return
        inputs = manifest.get("inputs")
        if not isinstance(inputs, list):
            return
        for record in inputs:
            if not isinstance(record, dict) or record.get("role") != "reference":
                continue
            relative_image = record.get("path")
            if not isinstance(relative_image, str) or Path(relative_image).is_absolute():
                continue
            candidate = (run_dir / relative_image).resolve()
            if candidate.is_relative_to(run_dir) and candidate.is_file() and candidate.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
                scene.fishy_generation_image = str(candidate)
                break
    except (OSError, ValueError, RuntimeError):
        # Missing/corrupt provenance must never overwrite current form data.
        return


def poll_job(state):
    process = state.get("process")
    if process is None:
        state["timer"] = None
        return None
    if state.get("started_at") is not None:
        state["elapsed_seconds"] = max(0, int(time.monotonic() - state["started_at"]))
    manifest = read_run_manifest(state)
    return_code = process.poll()
    if return_code is None:
        stage = (manifest or {}).get("status")
        state["status"] = {
            "prepared": "Preparing reference…",
            "generating": "Astra is generating a recipe…",
            "validated": "Recipe validated…",
            "building": "Blender is building the scene…",
            "complete": "Finishing…",
        }.get(stage, "Starting generation…")
        redraw_viewports()
        return 1.0
    result = completed_scene_path(state, manifest)
    if return_code == 0 and result is not None:
        state["result_file"] = str(result)
        state["status"] = "New scene ready"
        state["error"] = ""
    else:
        state["status"] = "Generation failed"
        state["error"] = error_summary(manifest)
    state["process"] = None
    state["timer"] = None
    redraw_viewports()
    return None


def attach_timer(state):
    previous = state.get("timer")
    if previous is not None and bpy.app.timers.is_registered(previous):
        bpy.app.timers.unregister(previous)
    if state.get("process") is None:
        state["timer"] = None
        return

    def callback():
        return poll_job(state)

    state["timer"] = callback
    bpy.app.timers.register(callback, first_interval=1.0, persistent=True)


class FISHY_OT_generate_design(bpy.types.Operator):
    bl_idname = "fishy.generate_design"
    bl_label = "Generate with Astra"
    bl_description = "Make one Astra request using your Codex login and build a new editable scene; keep this aquarium open"

    @classmethod
    def poll(cls, context):
        if is_running():
            cls.poll_message_set("A generation is already running.")
            return False
        return context.scene is not None

    def execute(self, context):
        state = generation_state()
        # Keep the guard inside execute as well for direct Python invocations.
        if is_running(state):
            self.report({"WARNING"}, "A generation is already running.")
            return {"CANCELLED"}
        environment = child_environment()
        python_binary = shutil.which("python3", path=environment["PATH"])
        if python_binary is None:
            self.report({"ERROR"}, "External Python 3 is unavailable.")
            return {"CANCELLED"}
        if shutil.which("codex", path=environment["PATH"]) is None:
            self.report({"ERROR"}, "Codex CLI is unavailable. Install and sign in locally first.")
            return {"CANCELLED"}
        scene = context.scene
        try:
            command = generation_command(
                python_binary,
                bpy.path.abspath(scene.fishy_generation_image),
                scene.fishy_generation_brief,
                [scene.fishy_generation_width_cm, scene.fishy_generation_depth_cm, scene.fishy_generation_height_cm],
                scene.fishy_generation_substrate_cm,
                bpy.app.binary_path,
                scene.fishy_reference_view,
            )
            descriptor, log_path = tempfile.mkstemp(prefix="fishy-generation-", suffix=".log")
            with os.fdopen(descriptor, "w", encoding="utf-8") as log:
                process = subprocess.Popen(
                    command,
                    stdin=subprocess.DEVNULL,
                    stdout=log,
                    stderr=subprocess.STDOUT,
                    cwd=str(ROOT),
                    env=environment,
                    start_new_session=True,
                )
        except (OSError, TypeError, ValueError) as exc:
            # Our validation messages contain no image contents or prompt text.
            self.report({"ERROR"}, str(exc) if isinstance(exc, ValueError) else "Could not launch the local generation runner.")
            return {"CANCELLED"}
        state.update({
            "process": process,
            "log_path": log_path,
            "run_dir": "",
            "result_file": "",
            "status": "Starting generation…",
            "error": "",
            "started_at": time.monotonic(),
            "elapsed_seconds": 0,
            "snapshot_state_hash": None,
            "snapshot_scene_id": None,
        })
        attach_timer(state)
        redraw_viewports()
        self.report({"INFO"}, "Astra generation started. Continue editing while it runs.")
        return {"FINISHED"}


class FISHY_OT_open_generated_scene(bpy.types.Operator):
    bl_idname = "fishy.open_generated_scene"
    bl_label = "Open Result in New Blender"
    bl_description = "Open the generated aquarium in a separate Blender process, preserving this file and unsaved edits"

    @classmethod
    def poll(cls, context):
        result = generation_state().get("result_file")
        return bool(result and Path(result).is_file())

    def execute(self, context):
        state = generation_state()
        if state.get("snapshot_state_hash"):
            try:
                current = native_snapshot.adapt_scene(context)
                if current["stateHash"] != state["snapshot_state_hash"] or current["sceneId"] != state.get("snapshot_scene_id"):
                    raise ValueError("The current scene changed after dispatch. This result is stale; capture a new revision.")
            except (ValueError, KeyError) as exc:
                self.report({"ERROR"}, str(exc))
                return {"CANCELLED"}
        result = generation_state().get("result_file")
        if not result or not Path(result).is_file():
            self.report({"ERROR"}, "The generated Blender file is unavailable.")
            return {"CANCELLED"}
        command = [
            bpy.app.binary_path, result,
            "--python", str(ROOT / "fishy_controls.py"),
            "--python", str(ROOT / "fishy_generation.py"),
        ]
        try:
            subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                             stderr=subprocess.DEVNULL, cwd=str(ROOT),
                             env=child_environment(), start_new_session=True)
        except OSError:
            self.report({"ERROR"}, "Could not launch a separate Blender process.")
            return {"CANCELLED"}
        self.report({"INFO"}, "Opening the generated scene in a separate Blender process.")
        return {"FINISHED"}


class FISHY_OT_revise_current_scene(bpy.types.Operator):
    bl_idname = "fishy.revise_current_scene"
    bl_label = "Revise Current Scene with Astra"
    bl_description = "Capture this unsaved scene, preserve human-protected meshes, and request one separate revision"

    @classmethod
    def poll(cls, context):
        return context.scene is not None and not is_running() and context.mode == "OBJECT"

    def execute(self, context):
        state = generation_state()
        if is_running(state):
            return {"CANCELLED"}
        environment = child_environment()
        python = shutil.which("python3", path=environment["PATH"])
        if not python or not shutil.which("codex", path=environment["PATH"]):
            self.report({"ERROR"}, "Local Python and signed-in Codex are required.")
            return {"CANCELLED"}
        scene = context.scene
        try:
            snapshot_path, snapshot = native_snapshot.capture_scene(context, ROOT / "snapshots" / uuid.uuid4().hex)
            command = [python, str(ROOT / "generate_scene.py"), "generate", "--frontier", "--current-scene", str(snapshot_path),
                       "--expected-snapshot-hash", hashlib.sha256(snapshot_path.read_bytes()).hexdigest(),
                       "--brief", scene.fishy_generation_brief, "--backend", "codex", "--blender", bpy.app.binary_path,
                       "--run-root", str(RUN_ROOT)]
            if scene.fishy_answer_response:
                if not scene.fishy_answer_photo:
                    raise ValueError("Select the exact photo named by the response JSON.")
                command += ["--answer-response", bpy.path.abspath(scene.fishy_answer_response), "--answer-photo", bpy.path.abspath(scene.fishy_answer_photo)]
            elif scene.fishy_answer_request:
                if not scene.fishy_answer_photo:
                    raise ValueError("Select a photo for the named request.")
                command += ["--answer-request", scene.fishy_answer_request, "--answer-photo", bpy.path.abspath(scene.fishy_answer_photo),
                            "--answer-view", scene.fishy_answer_view]
            elif scene.fishy_answer_photo:
                raise ValueError("A photo needs an explicit request ID or response JSON.")
            descriptor, log_path = tempfile.mkstemp(prefix="fishy-revision-", suffix=".log")
            with os.fdopen(descriptor, "w", encoding="utf-8") as log:
                process = subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT,
                                           cwd=str(ROOT), env=environment, start_new_session=True)
        except (OSError, ValueError, KeyError) as exc:
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}
        state.update(process=process, log_path=log_path, run_dir="", result_file="", status="Revising current unsaved scene…",
                     error="", started_at=time.monotonic(), elapsed_seconds=0,
                     snapshot_state_hash=snapshot["stateHash"], snapshot_scene_id=snapshot["sceneId"])
        attach_timer(state)
        self.report({"INFO"}, "Current scene captured. Protected native meshes will be preserved in a separate result.")
        return {"FINISHED"}


class FISHY_PT_generation(bpy.types.Panel):
    bl_label = "Astra Design"
    bl_idname = "FISHY_PT_generation"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Fishy"
    bl_order = 1

    def draw(self, context):
        layout = self.layout
        state = generation_state()
        active = is_running(state)
        form = layout.column()
        form.enabled = not active
        form.prop(context.scene, "fishy_generation_image", text="Reference")
        form.prop(context.scene, "fishy_reference_view", text="Reference view")
        form.prop(context.scene, "fishy_generation_brief", text="Brief")
        form.label(text="Assumed tank dimensions · cm")
        dimensions = form.column(align=True)
        dimensions.prop(context.scene, "fishy_generation_width_cm", text="Width")
        dimensions.prop(context.scene, "fishy_generation_depth_cm", text="Depth")
        dimensions.prop(context.scene, "fishy_generation_height_cm", text="Height")
        dimensions.prop(context.scene, "fishy_generation_substrate_cm", text="Substrate")
        form.operator("fishy.generate_design", icon="PLAY")
        revision = form.box()
        revision.label(text="Current unsaved scene revision")
        revision.label(text="Manual edits protect their objects.")
        revision.prop(context.scene, "fishy_answer_request", text="Request ID")
        revision.prop(context.scene, "fishy_answer_photo", text="Answer photo")
        revision.prop(context.scene, "fishy_answer_view", text="Answer view")
        revision.prop(context.scene, "fishy_answer_response", text="Browser response")
        revision.operator("fishy.revise_current_scene", icon="FILE_REFRESH")
        revision.label(text="Supports move, yaw and positive scale.")
        revision.label(text="Topology, tilt and shear stop revision.")
        try:
            frontier = json.loads(context.scene.get("fishy_frontier_json", "{}"))
            for request in frontier.get("requests", []):
                pending = revision.box()
                pending.label(text=request["id"] + " · " + request["status"])
                for line in textwrap.wrap(request["question"], width=43):
                    pending.label(text=line)
        except (ValueError, KeyError):
            pass
        help_box = layout.column(align=True)
        help_box.label(text="Uses your existing Codex login.")
        help_box.label(text="One request per click; approximate assets.")
        help_box.label(text="Reference scale is treated as assumed.")
        if state["status"] != "Ready":
            status = layout.box()
            status.label(text=state["status"], icon="TIME" if active else ("ERROR" if state["error"] else "CHECKMARK"))
            elapsed = state.get("elapsed_seconds", 0)
            status.label(text=f"Elapsed: {elapsed // 60}m {elapsed % 60}s")
            if state["error"]:
                for line in textwrap.wrap(state["error"], width=43):
                    status.label(text=line)
            result = state.get("result_file")
            if result:
                status.label(text="Result file:")
                for line in textwrap.wrap(result, width=43, break_long_words=True, break_on_hyphens=False):
                    status.label(text=line)
                status.operator("fishy.open_generated_scene", icon="FILE_BLEND")
            elif state.get("run_dir"):
                status.label(text="Run: " + Path(state["run_dir"]).name)
            elif state["error"] and state.get("log_path"):
                status.label(text="Temporary log:")
                for line in textwrap.wrap(state["log_path"], width=43, break_long_words=True, break_on_hyphens=False):
                    status.label(text=line)


CLASSES = (FISHY_OT_generate_design, FISHY_OT_revise_current_scene, FISHY_OT_open_generated_scene, FISHY_PT_generation)
PROPERTY_NAMES = (
    "fishy_generation_image", "fishy_generation_brief",
    "fishy_generation_width_cm", "fishy_generation_depth_cm",
    "fishy_generation_height_cm", "fishy_generation_substrate_cm",
    "fishy_answer_request", "fishy_answer_photo", "fishy_answer_view", "fishy_answer_response",
    "fishy_reference_view",
)


def unregister():
    state = generation_state()
    previous_header = state.get("header_draw")
    if previous_header is not None:
        try:
            bpy.types.VIEW3D_HT_tool_header.remove(previous_header)
        except (ValueError, AttributeError):
            pass
    state["header_draw"] = None
    timer = state.get("timer")
    if timer is not None and bpy.app.timers.is_registered(timer):
        bpy.app.timers.unregister(timer)
    state["timer"] = None
    # Do not terminate a process or discard its state during script reload.
    for cls in reversed(CLASSES):
        registered = getattr(bpy.types, cls.__name__, None)
        if registered is not None:
            bpy.utils.unregister_class(registered)
    for name in PROPERTY_NAMES:
        if hasattr(bpy.types.Scene, name):
            delattr(bpy.types.Scene, name)


def register():
    state = generation_state()
    unregister()
    bpy.types.Scene.fishy_generation_image = StringProperty(
        name="Reference image", description="PNG, JPEG, or WebP reference; sent to Astra only when you click Generate",
        subtype="FILE_PATH", default="")
    bpy.types.Scene.fishy_generation_brief = StringProperty(
        name="Design brief", description="Describe the composition you want", maxlen=4000, default=DEFAULT_BRIEF)
    bpy.types.Scene.fishy_answer_request = StringProperty(name="Request ID", maxlen=100, default="")
    bpy.types.Scene.fishy_answer_photo = StringProperty(name="Answer photo", subtype="FILE_PATH", default="")
    bpy.types.Scene.fishy_answer_response = StringProperty(name="Browser response JSON", subtype="FILE_PATH", default="")
    bpy.types.Scene.fishy_answer_view = EnumProperty(name="Answer view", items=[(view, view.replace("_", " ").title(), "") for view in ("front", "left", "right", "top", "close_up")], default="close_up")
    bpy.types.Scene.fishy_reference_view = EnumProperty(name="Reference view", items=[(view, view.replace("_", " ").title(), "") for view in ("front", "left", "right", "top", "overview", "close_up")], default="overview")
    for name, label, default in (
        ("fishy_generation_width_cm", "Tank width", 60),
        ("fishy_generation_depth_cm", "Tank depth", 30),
        ("fishy_generation_height_cm", "Tank height", 36),
    ):
        setattr(bpy.types.Scene, name, FloatProperty(name=label, default=default, min=10, max=300, precision=1))
    bpy.types.Scene.fishy_generation_substrate_cm = FloatProperty(name="Substrate depth", default=3, min=0, max=20, precision=1)
    if bpy.context.scene is not None:
        seed_from_current_scene(bpy.context.scene)
    for cls in CLASSES:
        bpy.utils.register_class(cls)
    bpy.types.VIEW3D_HT_tool_header.append(draw_tool_header)
    state["header_draw"] = draw_tool_header
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.show_region_tool_header = True
    attach_timer(state)
    redraw_viewports()


if __name__ == "__main__":
    register()
