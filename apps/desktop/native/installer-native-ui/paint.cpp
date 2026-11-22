#include "paint.h"

#include <algorithm>
#include <array>

namespace installer {
namespace {

using namespace Gdiplus;

Color Alpha(ARGB color, BYTE opacity) {
  const Color source(color);
  return Color(opacity, source.GetR(), source.GetG(), source.GetB());
}

void RoundPath(GraphicsPath& path, const RectF& bounds, float radius) {
  const float diameter = std::min({radius * 2, bounds.Width, bounds.Height});
  if (diameter <= 0) {
    path.AddRectangle(bounds);
    return;
  }
  const float left = bounds.X;
  const float top = bounds.Y;
  const float right = bounds.GetRight() - diameter;
  const float bottom = bounds.GetBottom() - diameter;
  path.AddArc(left, top, diameter, diameter, 180, 90);
  path.AddArc(right, top, diameter, diameter, 270, 90);
  path.AddArc(right, bottom, diameter, diameter, 0, 90);
  path.AddArc(left, bottom, diameter, diameter, 90, 90);
  path.CloseFigure();
}

void Panel(Graphics& canvas, const RectF& bounds, float radius, ARGB background,
           ARGB border = 0, float thickness = 0) {
  GraphicsPath path;
  RoundPath(path, bounds, radius);
  if (background != 0) {
    SolidBrush brush{Color(background)};
    canvas.FillPath(&brush, &path);
  }
  if (border != 0 && thickness > 0) {
    Pen pen(Color(border), thickness);
    pen.SetAlignment(PenAlignmentInset);
    canvas.DrawPath(&pen, &path);
  }
}

void DrawBackdrop(Graphics& canvas, const Element& element) {
  const auto& bounds = element.bounds;
  const auto& node = *element.node;
  const auto backdrop_state = canvas.Save();
  canvas.SetCompositingQuality(CompositingQualityHighQuality);
  canvas.SetSmoothingMode(SmoothingModeNone);
  SolidBrush background{Color(node.Color(L"canvascolor"))};
  canvas.FillRectangle(&background, bounds);
  canvas.SetSmoothingMode(SmoothingModeAntiAlias);

  const auto blue = node.Color(L"bluecolor");
  const auto green = node.Color(L"greencolor");
  const RectF bloom(bounds.X + bounds.Width * 0.18F, bounds.Y - bounds.Height * 0.56F,
                    bounds.Width * 0.64F, bounds.Height * 0.96F);
  GraphicsPath bloom_path;
  bloom_path.AddEllipse(bloom);
  PathGradientBrush brush(&bloom_path);
  brush.SetCenterColor(Alpha(blue, 70));
  const Color transparent_blue = Alpha(blue, 0);
  int blue_count = 1;
  brush.SetSurroundColors(&transparent_blue, &blue_count);
  canvas.FillPath(&brush, &bloom_path);

  const float ribbon_width = bounds.Height * 0.075F;
  const auto blue_state = canvas.Save();
  canvas.TranslateTransform(bounds.X + bounds.Width * 0.22F, bounds.Y + bounds.Height * 0.26F);
  canvas.RotateTransform(-16);
  Pen blue_ribbon(Alpha(blue, 30), ribbon_width);
  canvas.DrawEllipse(&blue_ribbon, -bounds.Width * 0.40F, -bounds.Height * 0.14F,
                     bounds.Width * 0.78F, bounds.Height * 0.36F);
  canvas.Restore(blue_state);

  const auto green_state = canvas.Save();
  canvas.TranslateTransform(bounds.X + bounds.Width * 0.78F, bounds.Y + bounds.Height * 0.26F);
  canvas.RotateTransform(17);
  Pen green_ribbon(Alpha(green, 32), ribbon_width);
  canvas.DrawEllipse(&green_ribbon, -bounds.Width * 0.40F, -bounds.Height * 0.14F,
                     bounds.Width * 0.76F, bounds.Height * 0.35F);
  canvas.Restore(green_state);
  canvas.Restore(backdrop_state);
}

void DrawBrand(Graphics& canvas, const Element& element) {
  const auto& bounds = element.bounds;
  const float unit = std::min(bounds.Width, bounds.Height);
  const float scale = unit / 27.91F;
  const float left = bounds.X + (bounds.Width - unit) * 0.5F;
  const float top = bounds.Y + (bounds.Height - unit) * 0.5F;
  const auto point = [=](float x, float y) { return PointF(left + x * scale, top + y * scale); };

  GraphicsPath shape;
  shape.AddBezier(point(27.91F, 13.955F), point(27.91F, 23.5889F),
                  point(23.5889F, 27.91F), point(13.955F, 27.91F));
  shape.AddBezier(point(13.955F, 27.91F), point(4.32108F, 27.91F),
                  point(0, 23.5889F), point(0, 13.955F));
  shape.AddBezier(point(0, 13.955F), point(0, 4.32108F),
                  point(4.32108F, 0), point(13.955F, 0));
  shape.AddBezier(point(13.955F, 0), point(23.5889F, 0),
                  point(27.91F, 4.32108F), point(27.91F, 13.955F));
  shape.CloseFigure();
  SolidBrush brand{Color(element.node->Color(L"brandcolor"))};
  canvas.FillPath(&brand, &shape);
  const PointF stem[] = {
      point(15.2158F, 5.91748F), point(11.3336F, 5.91748F), point(10.6526F, 7.97694F),
      point(12.8088F, 7.97694F), point(12.8088F, 12.315F), point(15.2158F, 12.315F)};
  SolidBrush ink{Color(ThemeColor(L"ink"))};
  canvas.FillPolygon(&ink, stem, static_cast<INT>(std::size(stem)));
  canvas.FillEllipse(&ink, left + 9.52759F * scale, top + 13.1377F * scale,
                     8.85491F * scale, 8.85491F * scale);
  canvas.FillEllipse(&brand, left + 11.5376F * scale, top + 15.1477F * scale,
                     4.8349F * scale, 4.8349F * scale);
}

void DrawSuccess(Graphics& canvas, const Element& element) {
  const auto& bounds = element.bounds;
  const float unit = std::min(bounds.Width, bounds.Height);
  const float left = bounds.X + (bounds.Width - unit) * 0.5F;
  const float top = bounds.Y + (bounds.Height - unit) * 0.5F;
  const auto accent_color = element.node->Color(L"accentcolor");
  SolidBrush halo(Alpha(accent_color, 28));
  canvas.FillEllipse(&halo, left, top, unit, unit);
  const float inset = unit * 0.13F;
  SolidBrush accent{Color(accent_color)};
  canvas.FillEllipse(&accent, left + inset, top + inset, unit - inset * 2, unit - inset * 2);
  Pen check(Color(element.node->Color(L"inkcolor")), unit * 0.055F);
  check.SetStartCap(LineCapRound);
  check.SetEndCap(LineCapRound);
  const PointF points[] = {
      {left + unit * 0.35F, top + unit * 0.51F},
      {left + unit * 0.47F, top + unit * 0.63F},
      {left + unit * 0.68F, top + unit * 0.38F}};
  canvas.DrawLines(&check, points, static_cast<INT>(std::size(points)));
}

void DrawProgress(Graphics& canvas, const Element& element, const State& state) {
  const auto& bounds = element.bounds;
  const auto& node = *element.node;
  const RectF track(bounds.X + 10, bounds.Y + (bounds.Height - 8) * 0.5F, bounds.Width - 20, 8);
  Panel(canvas, track, 4, node.Color(L"trackcolor"));
  const float width = track.Width * state.display_progress / 100;
  if (width <= 0.5F) {
    return;
  }
  const RectF fill(track.X, track.Y, width, track.Height);
  GraphicsPath fill_path;
  RoundPath(fill_path, fill, 4);
  const auto end_color = node.Color(L"endcolor");
  LinearGradientBrush gradient(fill, Color(node.Color(L"startcolor")), Color(end_color),
                              LinearGradientModeHorizontal);
  canvas.FillPath(&gradient, &fill_path);
  const auto clip = canvas.Save();
  canvas.SetClip(&fill_path, CombineModeIntersect);
  SolidBrush shimmer(Color(105, 255, 255, 255));
  canvas.FillRectangle(&shimmer, fill.X + fill.Width * state.shimmer - 7,
                       fill.Y - 2, 14.0F, fill.Height + 4);
  canvas.Restore(clip);

  const float endpoint = fill.GetRight();
  const float center_y = track.Y + track.Height * 0.5F;
  SolidBrush halo(Alpha(end_color, 40));
  canvas.FillEllipse(&halo, endpoint - 11, center_y - 11, 22.0F, 22.0F);
  SolidBrush orb{Color(end_color)};
  canvas.FillEllipse(&orb, endpoint - 7, center_y - 7, 14.0F, 14.0F);
  SolidBrush center(Color(255, 255, 255, 255));
  canvas.FillEllipse(&center, endpoint - 2, center_y - 2, 4.0F, 4.0F);
}

void DrawLegal(Graphics& canvas, const Element& element, const Gdiplus::Font& font,
               const State& state, const Interaction& input, LegalBounds& link_bounds) {
  const auto raw = ElementText(*element.node, state, true);
  std::array<CharacterRange, 2> ranges{};
  std::wstring text;
  std::wstring_view remainder(raw);
  for (std::size_t i = 0; i < kLegalLinks.size(); ++i) {
    const std::wstring marker = L"{a " + std::wstring(kLegalLinks[i]) + L"}";
    const auto begin = remainder.find(marker);
    const auto end = begin == std::wstring_view::npos ? begin : remainder.find(L"{/a}", begin);
    if (end == std::wstring_view::npos) {
      text = raw;
      ranges = {};
      remainder = {};
      break;
    }
    text.append(remainder.substr(0, begin));
    ranges[i] = CharacterRange(static_cast<int>(text.size()), static_cast<int>(end - begin - marker.size()));
    text.append(remainder.substr(begin + marker.size(), ranges[i].Length));
    remainder.remove_prefix(end + 4);
    if (!remainder.empty() && remainder.front() == L' ') {
      remainder.remove_prefix(1);
    }
  }
  text.append(remainder);
  StringFormat format(StringFormat::GenericTypographic());
  format.SetAlignment(StringAlignmentCenter);
  format.SetLineAlignment(StringAlignmentCenter);
  format.SetFormatFlags(StringFormatFlagsNoWrap | StringFormatFlagsMeasureTrailingSpaces);
  const auto normal = element.node->Color(L"textcolor");
  SolidBrush brush{Color(normal)};
  canvas.DrawString(text.c_str(), static_cast<int>(text.size()), &font, element.bounds, &format, &brush);
  format.SetMeasurableCharacterRanges(static_cast<int>(ranges.size()), ranges.data());
  std::array<Region, 2> regions;
  if (canvas.MeasureCharacterRanges(text.c_str(), static_cast<int>(text.size()), &font,
                                    element.bounds, &format, static_cast<int>(regions.size()),
                                    regions.data()) != Ok) {
    return;
  }
  for (std::size_t i = 0; i < regions.size(); ++i) {
    if (ranges[i].Length == 0) {
      continue;
    }
    auto& bounds = link_bounds[i];
    regions[i].GetBounds(&bounds, &canvas);
    const bool active = input.hovered == kLegalLinks[i] || input.focused == kLegalLinks[i];
    Pen underline(Color(active ? element.node->Color(L"hotlinkcolor", normal) : normal),
                  active ? 1.5F : 1.0F);
    canvas.DrawLine(&underline, bounds.X, bounds.GetBottom() - 1.5F,
                    bounds.GetRight(), bounds.GetBottom() - 1.5F);
  }
}

void DrawCaption(Graphics& canvas, const Element& element, ARGB color) {
  const auto& bounds = element.bounds;
  const auto x = bounds.X + bounds.Width * 0.5F;
  const auto y = bounds.Y + bounds.Height * 0.5F;
  Pen pen(Color(color), std::max(1.5F, bounds.Width * 0.05F));
  pen.SetStartCap(LineCapRound);
  pen.SetEndCap(LineCapRound);
  if (element.node->Attribute(L"kind") == L"close") {
    const float radius = std::min(bounds.Width, bounds.Height) * 0.17F;
    canvas.DrawLine(&pen, x - radius, y - radius, x + radius, y + radius);
    canvas.DrawLine(&pen, x + radius, y - radius, x - radius, y + radius);
  } else {
    const float half_width = bounds.Width * 0.19F;
    canvas.DrawLine(&pen, x - half_width, y, x + half_width, y);
  }
}

void DrawLabel(Graphics& canvas, const Element& element, const Gdiplus::Font& font,
               const State& state, bool welcome, ARGB foreground) {
  const auto& node = *element.node;
  const auto alignment = node.Attribute(L"align");
  StringFormat format(StringFormat::GenericTypographic());
  if (alignment == L"center" || node.kind == Kind::button) {
    format.SetAlignment(StringAlignmentCenter);
  } else if (alignment == L"right") {
    format.SetAlignment(StringAlignmentFar);
  }
  format.SetLineAlignment(StringAlignmentCenter);
  const bool multiline = node.Attribute(L"wordbreak") == L"true";
  format.SetFormatFlags(multiline ? 0 : StringFormatFlagsNoWrap);
  if (!multiline && node.Attribute(L"name") == L"install-directory") {
    format.SetTrimming(StringTrimmingEllipsisCharacter);
  }
  const auto text = ElementText(node, state, welcome);
  SolidBrush brush{Color(foreground)};
  canvas.DrawString(text.c_str(), static_cast<int>(text.size()), &font, element.bounds, &format, &brush);
}

}  // namespace

Fonts CreateFonts(const Page& page, std::wstring_view locale) {
  Fonts fonts;
  for (const auto& spec : page.fonts) {
    const auto selected = SelectFontFamily(spec.families, locale);
    Gdiplus::FontFamily family(selected.c_str());
    const int style = spec.bold && family.IsStyleAvailable(FontStyleBold) ? FontStyleBold : FontStyleRegular;
    fonts.push_back(std::make_unique<Gdiplus::Font>(&family, static_cast<float>(spec.size), style, UnitPixel));
  }
  return fonts;
}

void Paint(Graphics& canvas, const std::vector<Element>& elements, const Fonts& fonts,
           const State& state, bool welcome, const Interaction& input, LegalBounds& legal_bounds) {
  canvas.SetSmoothingMode(SmoothingModeAntiAlias);
  canvas.SetTextRenderingHint(TextRenderingHintClearTypeGridFit);
  for (const auto& element : elements) {
    const auto& node = *element.node;
    if (element.bounds.IsEmptyArea() || node.kind == Kind::progress ||
        node.Attribute(L"name") == L"progress-value") {
      continue;
    }
    switch (node.kind) {
      case Kind::backdrop:
        DrawBackdrop(canvas, element);
        continue;
      case Kind::brand:
        DrawBrand(canvas, element);
        continue;
      case Kind::success:
        DrawSuccess(canvas, element);
        continue;
      case Kind::space:
        continue;
      default:
        break;
    }

    const auto name = node.Attribute(L"name");
    const float radius = node.Number(L"borderround") / 2.0F;
    const auto border_size = static_cast<float>(node.Number(L"bordersize"));
    const bool disabled = state.cancellation_locked && (name == L"cancel" || name == L"closebtn");
    const bool hovered = !name.empty() && name == input.hovered && !disabled;
    const bool pressed = hovered && name == input.pressed;
    const bool focused = !name.empty() && name == input.focused && !disabled;
    ARGB background = node.Color(L"bkcolor");
    ARGB border = node.Color(L"bordercolor");
    ARGB foreground = node.Color(L"textcolor", ThemeColor(L"textPrimary"));
    if (welcome && (name == L"scope-current" || name == L"scope-all")) {
      const bool selected = state.machine_scope == (name == L"scope-all");
      background = selected ? ThemeColor(L"brandSoft") : 0xCCFFFFFF;
      border = selected ? ThemeColor(L"brand") : ThemeColor(L"border");
    }
    if (pressed) {
      background = node.Color(L"pushedbkcolor", background);
      border = node.Color(L"pushedbordercolor", border);
    } else if (hovered) {
      background = node.Color(L"hotbkcolor", background);
      border = node.Color(L"hotbordercolor", border);
    }
    if (disabled || hovered) {
      foreground = disabled ? ThemeColor(L"textSecondary") : node.Color(L"hottextcolor", foreground);
    }
    if (node.kind == Kind::glass) {
      for (int spread = 12; spread > 0; --spread) {
        const float expansion = spread * 1.5F;
        const auto& b = element.bounds;
        const RectF shadow(b.X - expansion, b.Y - expansion * 0.6F + 4,
                           b.Width + expansion * 2, b.Height + expansion * 1.7F);
        Panel(canvas, shadow, 15 + expansion, 0x01435D50);
      }
    }
    Panel(canvas, element.bounds, radius, background, border, border_size);
    const auto& font = *fonts.at(static_cast<std::size_t>(node.Number(L"font")));
    if (node.kind == Kind::caption) {
      const auto normal = node.Color(L"iconcolor");
      DrawCaption(canvas, element, hovered ? node.Color(L"hoticoncolor", normal) : normal);
    } else if (node.kind == Kind::label || node.kind == Kind::button) {
      DrawLabel(canvas, element, font, state, welcome, foreground);
    } else if (node.kind == Kind::legal) {
      DrawLegal(canvas, element, font, state, input, legal_bounds);
    }
    if (focused) {
      const auto& b = element.bounds;
      const RectF focus(b.X + 2, b.Y + 2, b.Width - 4, b.Height - 4);
      Panel(canvas, focus, std::max(0.0F, radius - 2), 0, ThemeColor(L"textPrimary"), 1);
    }
  }
}

void PaintProgress(Graphics& canvas, const std::vector<Element>& elements,
                   const Fonts& fonts, const State& state) {
  canvas.SetSmoothingMode(SmoothingModeAntiAlias);
  canvas.SetTextRenderingHint(TextRenderingHintClearTypeGridFit);
  for (const auto& element : elements) {
    const auto& node = *element.node;
    if (node.kind == Kind::progress) {
      const auto saved = canvas.Save();
      canvas.SetCompositingQuality(CompositingQualityHighQuality);
      DrawProgress(canvas, element, state);
      canvas.Restore(saved);
    } else if (node.Attribute(L"name") == L"progress-value") {
      const auto& font = *fonts.at(static_cast<std::size_t>(node.Number(L"font")));
      DrawLabel(canvas, element, font, state, false, node.Color(L"textcolor"));
    }
  }
}

}  // namespace installer
