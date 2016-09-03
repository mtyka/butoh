CC=/Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/c++

%.o: %.cpp
	g++ -w -DLOG_TO_STDOUT=1  -I/usr/local/include/ -c -o $@ $< 

libcppwebsock.dylib: Util.o WebSocketServer.o
	$(CC) -Wall -O2 -dynamiclib  -lwebsockets -o $@ Util.o WebSocketServer.o 

