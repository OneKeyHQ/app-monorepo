#pragma once

#include <windows.h>
#include <objidl.h>
#include <gdiplus.h>

#include <map>
#include <string>
#include <string_view>
#include <vector>

namespace installer {

using Dictionary = std::map<std::wstring_view, std::wstring_view>;

enum class Kind {
  overlay, vertical, glass, horizontal, label, button, caption, backdrop,
  brand, progress, legal, success, space
};

struct Node {
  Kind kind;
  Dictionary attributes;
  std::vector<Node> children;

  std::wstring_view Attribute(std::wstring_view key) const;
  int Number(std::wstring_view key) const;
  Gdiplus::ARGB Color(std::wstring_view key, Gdiplus::ARGB fallback = 0) const;
};

struct Font {
  std::wstring_view families;
  int size;
  bool bold;
};

struct Page {
  int caption_height;
  std::vector<Font> fonts;
  std::vector<Node> roots;
};

struct Geometry {
  int width;
  int height;
  int radius;
};

struct State {
  std::wstring locale;
  std::wstring version;
  std::wstring status;
  std::wstring install_directory;
  std::wstring per_user_directory;
  std::wstring per_machine_directory;
  int progress = 0;
  float display_progress = 0;
  float shimmer = -0.35F;
  bool advanced_options = false;
  bool options_visited = false;
  bool machine_scope = false;
  bool cancellation_locked = false;
};

struct Element {
  const Node* node;
  Gdiplus::RectF bounds;
};

const Geometry& WindowGeometry();
const Page* FindPage(std::wstring_view name);
std::wstring_view Text(std::wstring_view locale, std::wstring_view key);
Gdiplus::ARGB ThemeColor(std::wstring_view name);
std::wstring ElementText(const Node& node, const State& state, bool welcome);
std::wstring SelectFontFamily(std::wstring_view families, std::wstring_view locale);
Gdiplus::RectF Inset(Gdiplus::RectF bounds, std::wstring_view values);
std::vector<Element> Layout(const Page& page, const State& state);

}  // namespace installer
