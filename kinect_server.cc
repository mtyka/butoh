#include <stdio.h>
#include "cppWebSockets/WebSocketServer.h"
#include "png.h"




class KinectServer : public WebSocketServer
{
public: 
    KinectServer( int port );
    ~KinectServer( );
    virtual void onConnect(    int socketID                        );
    virtual void onMessage(    int socketID, const string& data    );
    virtual void onDisconnect( int socketID                        );
    virtual void   onError(    int socketID, const string& message );
};

int main( int argc, char **argv )
{
    KinectServer es = KinectServer( 8080 );
    es.run( );
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

void KinectServer::onMessage( int socketID, const string& data )
{
    // Reply back with the same message
    std::cout << "Received: " << socketID << "  " <<  data << std::endl;;
    this->send( socketID, data );
}

void KinectServer::onDisconnect( int socketID )
{
    std::cout << "Disconnect" << std::endl;
}

void KinectServer::onError( int socketID, const string& message )
{
    std::cout << "Error: " << socketID << "  " <<  message << std::endl;
}


