declare module "smartcrop-sharp" {
  interface Crop {
    x: number;
    y: number;
    width: number;
    height: number;
  }
  interface CropResult {
    topCrop: Crop;
  }
  interface CropOptions {
    width: number;
    height: number;
  }
  const smartcrop: {
    crop(input: Buffer, options: CropOptions): Promise<CropResult>;
  };
  export default smartcrop;
}
