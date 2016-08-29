all:
	g++ -w -DLOG_TO_STDOUT=1 -okinect_server  png.cc  cppWebSockets/Util.cpp cppWebSockets/WebSocketServer.cpp kinect_server.cc  -lwebsockets -lpng -I/usr/local/include/ -L/usr/local/lib/
