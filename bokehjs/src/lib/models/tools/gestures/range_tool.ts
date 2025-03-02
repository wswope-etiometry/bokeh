import {Tool, ToolView} from "../tool"
import {OnOffButton} from "../on_off_button"
import type {PlotView} from "../../plots/plot"
import {BoxAnnotation} from "../../annotations/box_annotation"
import {Range1d} from "../../ranges/range1d"
import {logger} from "core/logging"
import type * as p from "core/properties"
import {tool_icon_range} from "styles/icons.css"
import {Node} from "../../coordinates/node"

const frame_left = new Node({target: "frame", symbol: "left"})
const frame_right = new Node({target: "frame", symbol: "right"})
const frame_top = new Node({target: "frame", symbol: "top"})
const frame_bottom = new Node({target: "frame", symbol: "bottom"})

export class RangeToolView extends ToolView {
  declare model: RangeTool
  declare readonly parent: PlotView

  override get overlays() {
    return [...super.overlays, this.model.overlay]
  }

  override initialize(): void {
    super.initialize()
    this.model.update_overlay_from_ranges()
  }

  override connect_signals(): void {
    super.connect_signals()

    if (this.model.x_range != null)
      this.connect(this.model.x_range.change, () => this.model.update_overlay_from_ranges())
    if (this.model.y_range != null)
      this.connect(this.model.y_range.change, () => this.model.update_overlay_from_ranges())

    this.model.overlay.pan.connect(([state, _]) => {
      if (state == "pan") {
        this.model.update_ranges_from_overlay()
      } else if (state == "pan:end") {
        this.parent.trigger_ranges_update_event()
      }
    })

    const {active} = this.model.properties
    this.on_change(active, () => {
      this.model.overlay.editable = this.model.active
    })
  }
}

const DEFAULT_RANGE_OVERLAY = () => {
  return new BoxAnnotation({
    syncable: false,
    level: "overlay",
    visible: true,
    editable: true,
    propagate_hover: true,
    left_limit: frame_left,
    right_limit: frame_right,
    top_limit: frame_top,
    bottom_limit: frame_bottom,
    fill_color: "lightgrey",
    fill_alpha: 0.5,
    line_color: "black",
    line_alpha: 1.0,
    line_width: 0.5,
    line_dash: [2, 2],
  })
}

export namespace RangeTool {
  export type Attrs = p.AttrsOf<Props>

  export type Props = Tool.Props & {
    x_range: p.Property<Range1d | null>
    y_range: p.Property<Range1d | null>
    x_interaction: p.Property<boolean>
    y_interaction: p.Property<boolean>
    overlay: p.Property<BoxAnnotation>
  }
}

export interface RangeTool extends RangeTool.Attrs {}

export class RangeTool extends Tool {
  declare properties: RangeTool.Props
  declare __view_type__: RangeToolView

  constructor(attrs?: Partial<RangeTool.Attrs>) {
    super(attrs)
  }

  static {
    this.prototype.default_view = RangeToolView

    this.define<RangeTool.Props>(({Boolean, Ref, Nullable}) => ({
      x_range:       [ Nullable(Ref(Range1d)), null ],
      y_range:       [ Nullable(Ref(Range1d)), null ],
      x_interaction: [ Boolean, true ],
      y_interaction: [ Boolean, true ],
      overlay:       [ Ref(BoxAnnotation), DEFAULT_RANGE_OVERLAY ],
    }))

    this.override<RangeTool.Props>({
      active: true,
    })
  }

  override initialize(): void {
    super.initialize()

    this.overlay.editable = this.active

    const has_x = this.x_range != null && this.x_interaction
    const has_y = this.y_range != null && this.y_interaction

    if (has_x && has_y) {
      this.overlay.movable = "both"
      this.overlay.resizable = "all"
    } else if (has_x) {
      this.overlay.movable = "x"
      this.overlay.resizable = "x"
    } else if (has_y) {
      this.overlay.movable = "y"
      this.overlay.resizable = "y"
    } else {
      this.overlay.movable = "none"
      this.overlay.resizable = "none"
    }
  }

  update_ranges_from_overlay(): void {
    const {left, right, top, bottom} = this.overlay
    if (this.x_range != null && this.x_interaction)
      this.x_range.setv({start: left, end: right})
    if (this.y_range != null && this.y_interaction)
      this.y_range.setv({start: bottom, end: top})
  }

  update_overlay_from_ranges(): void {
    const {x_range, y_range} = this
    const has_x = x_range != null
    const has_y = y_range != null

    this.overlay.update({
      left: has_x ? x_range.start : frame_left,
      right: has_x ? x_range.end : frame_right,
      top: has_y ? y_range.end : frame_top,
      bottom: has_y ? y_range.start : frame_bottom,
    })

    if (!has_x && !has_y) {
      logger.warn("RangeTool not configured with any Ranges.")
      this.overlay.clear()
    }
  }

  override tool_name = "Range Tool"
  override tool_icon = tool_icon_range

  override tool_button(): OnOffButton {
    return new OnOffButton({tool: this})
  }
}
