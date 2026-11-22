#pragma once

#include "paint.h"

#include <atomic>
#include <functional>

namespace installer {

class Window {
 public:
  Window(HINSTANCE module, std::wstring locale, std::wstring version);
  ~Window();

  Window(const Window&) = delete;
  Window& operator=(const Window&) = delete;

  bool Create(HWND host);
  bool Invoke(const std::function<void()>& operation);
  void Show();
  void Hide();
  void Destroy();
  void BindHost(HWND host);
  bool SetPage(std::wstring_view page);
  void SetProgress(int progress, bool reset);
  void SetDirectory(std::wstring directory, std::wstring_view scope);
  void SetStatus(std::wstring status);
  void SetVersion(std::wstring version);
  std::wstring_view Event(bool wait);
  std::wstring_view PrepareCommit();

 private:
  struct Surface {
    ~Surface();
    bool Ensure(HDC reference, LONG width, LONG height);
    void Reset();

    HDC dc = nullptr;
    HBITMAP bitmap = nullptr;
    HGDIOBJ initial_bitmap = nullptr;
    SIZE size{};
  };

  static BOOL CALLBACK LoadHostIcons(HMODULE module, LPCWSTR, LPWSTR name, LONG_PTR context);
  static LRESULT CALLBACK WindowProc(HWND hwnd, UINT message, WPARAM wparam, LPARAM lparam);
  LRESULT Handle(HWND hwnd, UINT message, WPARAM wparam, LPARAM lparam);

  void PlaceOnMonitor(HMONITOR monitor, UINT dpi);
  void Rebuild();
  void Redraw();
  void RedrawProgress(bool include_label);
  void Draw(HDC dc, const RECT& dirty);
  void OnAnimation();
  void OnClose(bool cancel_button);
  void Activate(std::wstring_view target);
  void FocusNext(bool reverse);
  bool Enabled(std::wstring_view target) const;
  std::wstring_view HitTest(LPARAM coordinates) const;

  HINSTANCE module_;
  DWORD owner_thread_;
  ULONG_PTR graphics_token_ = 0;
  bool class_registered_ = false;
  bool system_frame_ = false;
  float scale_ = 1;
  std::atomic<HWND> hwnd_{nullptr};
  HWND host_ = nullptr;
  HICON big_icon_ = nullptr;
  HICON small_icon_ = nullptr;
  Surface background_;
  Surface frame_;
  bool background_dirty_ = true;
  State state_;
  std::wstring page_name_;
  std::wstring_view event_;
  const Page* page_ = nullptr;
  Fonts fonts_;
  std::vector<Element> elements_;
  std::vector<std::wstring_view> tab_order_;
  LegalBounds legal_bounds_;
  Interaction input_;
  bool tracking_mouse_ = false;
  bool keyboard_focus_ = false;
  bool manual_progress_ = false;
  bool cancel_forwarded_ = false;
  ULONGLONG last_poll_at_ = 0;
  ULONGLONG cancel_requested_at_ = 0;
  ULONGLONG next_native_progress_at_ = 0;
};

}  // namespace installer
