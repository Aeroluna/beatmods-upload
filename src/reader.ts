export class DataViewReader {
  _buffer;
  _dataView;
  _position = 0;

  constructor(buffer: ArrayBuffer) {
    this._buffer = buffer;
    this._dataView = new DataView(buffer);
  }

  get position() {
    return this._position;
  }

  set position(value) {
    this._position = value;
  }

  get remainingBytes() {
    return this._dataView.byteLength - this.position;
  }

  tryAlign(alignment: number) {
    const remainder = this._position & (alignment - 1);
    const bytesToSkip = alignment - remainder;
    if (bytesToSkip > this.remainingBytes) {
      return false;
    }

    this._position += bytesToSkip;
    return true;
  }

  peekStringNullTerminated() {
    const utf8Decoder = new TextDecoder('utf-8');
    const bytes: number[] = [];
    for (let i = this.position; i < this._dataView.byteLength; i++) {
      const byte = this._dataView.getUint8(i);
      if (byte == 0) {
        break;
      }

      bytes.push(byte);
    }

    return {
      string: utf8Decoder.decode(new Uint8Array(bytes)),
      bytesRead: bytes.length
    };
  }

  readStringNullTerminated() {
    const result = this.peekStringNullTerminated();
    this._position += result.bytesRead;
    return result.string;
  }

  readString(size: number) {
    const utf8Decoder = new TextDecoder('utf-8');
    const result = utf8Decoder.decode(this._buffer.slice(this._position, size));
    this._position += size;
    return result;
  }

  readInt64() {
    const result = this._dataView.getBigInt64(this._position);
    this._position += 8;
    return result;
  }

  readUInt64() {
    const result = this._dataView.getBigUint64(this._position);
    this._position += 8;
    return result;
  }

  readFloat32() {
    const result = this._dataView.getFloat32(this._position);
    this._position += 4;
    return result;
  }

  readFloat64() {
    const result = this._dataView.getFloat64(this._position);
    this._position += 8;
    return result;
  }

  readInt16() {
    const result = this._dataView.getInt16(this._position);
    this._position += 2;
    return result;
  }

  readInt32() {
    const result = this._dataView.getInt32(this._position);
    this._position += 4;
    return result;
  }

  readInt8() {
    const result = this._dataView.getInt8(this._position);
    this._position += 1;
    return result;
  }

  readUInt16() {
    const result = this._dataView.getUint16(this._position);
    this._position += 2;
    return result;
  }

  readUInt32() {
    const result = this._dataView.getUint32(this._position);
    this._position += 4;
    return result;
  }

  readUInt8() {
    const result = this._dataView.getUint8(this._position);
    this._position += 1;
    return result;
  }
}
