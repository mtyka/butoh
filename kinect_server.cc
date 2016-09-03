#include <stdio.h>
#include "cppWebSockets/WebSocketServer.h"
#include "png.h"
#include "base64.h"
#include <string>
#include <iostream>
#include <fstream>



std::string rawRGBAToBase64PNG(unsigned char* rgba) {
  std::vector<unsigned char> pngdata;
  WritePngToMemory(w,h,rgba,&pngdata);
  return base64_encode(pngdata.data(), pngdata.size());
}


class KinectServer : public WebSocketServer
{
public: 
    KinectServer( int port );
    ~KinectServer( );
    virtual void onConnect(    int socketID                        );
    virtual void onMessage(    int socketID, const std::string& data    );
    virtual void onDisconnect( int socketID                        );
    virtual void   onError(    int socketID, const std::string& message );
};

int main( int argc, char **argv )
{
  KinectServer es = KinectServer( 8080 );
  es.run( );
  return 0;
}

KinectServer::KinectServer( int port ) : WebSocketServer( port )
{
}

KinectServer::~KinectServer( )
{
}


void KinectServer::onConnect( int socketID )
{
    std::cout << "New connection" << socketID << std::endl;
}

void KinectServer::onMessage( int socketID, const std::string& data )
{
    // Reply back with the same message
  std::cout << "Received: " << socketID << "  " <<  data << std::endl;;

  this->send( socketID, "REturn!");
}

void KinectServer::onDisconnect( int socketID )
{
    std::cout << "Disconnect" << std::endl;
}

void KinectServer::onError( int socketID, const std::string& message )
{
    std::cout << "Error: " << socketID << "  " <<  message << std::endl;
}


