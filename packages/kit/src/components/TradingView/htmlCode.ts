export const htmlCode = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      body {
        height: 100vh;
        width: 100vw;
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <div class="tradingview-widget-container" style="height:100%;width:100%">
      <div class="tradingview-widget-container__widget" style="height:calc(100% - 32px);width:100%"></div>
      <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js" async>
      {
      "fullscreen": true,
      "autosize": true,
      "symbol": "NASDAQ:AAPL",
      "interval": "D",
      "timezone": "Etc/UTC",
      "theme": "dark",
      "style": "1",
      "locale": "en",
      "hide_legend": true,
      "allow_symbol_change": false,
      "hideSymbolSearch": false,
      "save_image": false,
      "withdateranges": true,
      "widgetbar": {
          "details": false,
          "watchlist": false,
          "news": false,
          "datawindow": false,
          "watchlist_settings": {
              "default_symbols": []
          }
      },
      "calendar": false,
      "hide_side_toolbar": 0,
      "support_host": "https://www.tradingview.com"
    }
      </script>
    </div>
  </body>
</html>
`;
