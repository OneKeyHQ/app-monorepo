#pragma once

#include "theme.h"

#include <array>
#include <memory>

namespace installer {

struct Interaction {
  std::wstring_view hovered;
  std::wstring_view pressed;
  std::wstring_view focused;
};

using Fonts = std::vector<std::unique_ptr<Gdiplus::Font>>;
using LegalBounds = std::array<Gdiplus::RectF, 2>;
constexpr std::array<std::wstring_view, 2> kLegalLinks{L"terms", L"privacy"};

Fonts CreateFonts(const Page& page, std::wstring_view locale);
void Paint(Gdiplus::Graphics& canvas, const std::vector<Element>& elements,
           const Fonts& fonts, const State& state, bool welcome,
           const Interaction& input, LegalBounds& legal_bounds);
void PaintProgress(Gdiplus::Graphics& canvas, const std::vector<Element>& elements,
                   const Fonts& fonts, const State& state);

}  // namespace installer
