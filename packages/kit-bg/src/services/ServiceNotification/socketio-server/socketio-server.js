const { Server } = require('socket.io');
const http = require('http');

// 创建 HTTP 服务器
const server = http.createServer();

// 创建 Socket.IO 服务器
const io = new Server(server);

const allClients = {};

// 监听连接事件
io.on('connection', (socket) => {
  console.log('新客户端连接');
  allClients[socket.id] = socket;

  // 处理断开连接事件
  socket.on('disconnect', () => {
    console.log('客户端断开连接');
    delete allClients[socket.id];
  });

  // 在这里添加其他自定义事件处理程序
});

// http://localhost:4982/api/v1/notification/push?message=xxx&title=xxx&type=xxx
// 添加 HTTP 路由处理程序
server.on('request', (req, res) => {
  if (req.url.startsWith('/api/v1/notification/push')) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const message = url.searchParams.get('message');
    const title = url.searchParams.get('title');
    const type = url.searchParams.get('type');

    if (message && title && type) {
      // 向所有连接的客户端发送通知
      io.emit('notification', {
        message: `${message}: ${Date.now()}`,
        title,
        type,
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: '通知已发送' }));
    } else {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, message: '缺少必要参数' }));
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: '未找到路由' }));
  }
});

// 启动服务器
const PORT = 4982;
server.listen(PORT, () => {
  console.log(`Socket.IO 服务器正在监听端口 ${PORT}`);
});
