#include <stdlib.h>
#include <vector>

void WritePngToMemory(size_t w, size_t h, const unsigned char *dataRGBA, std::vector<unsigned char> *out); 
void WritePngToMemoryGrayAlpha(size_t w, size_t h, const unsigned char *dataRGBA, std::vector<unsigned char> *out); 
