import { MaterialMap } from "./types/MaterialMap";
import { MaterialTextures } from "./types/MaterialTextures";
import { MaterialViews } from "./types/MaterialViews";
import { MaterialSamplers } from "./types/MaterialSamplers";
import { MaterialURLs } from "./types/MaterialUrls";

export class MaterialObject {
    device: GPUDevice

    textures: MaterialTextures = {};
    views: MaterialViews = {};
    samplers: MaterialSamplers = {};
    bindGroupLayout: GPUBindGroupLayout;
    bindings: GPUBindGroupEntry[] = [];
    bindGroup: GPUBindGroup;

    textureArray: GPUTexture;
    view: GPUTextureView;
    sampler: GPUSampler;

    defaultImageURL: string;

    /**
     * Initializes the Object used for the Object being exported, creating the sampler and textures applying as specified in {@link MaterialMap}
     * @param device - The {@link GPUDevice} in use
     * @param urls - The material names and images that will be applied to it  
     * @param materialMap - Material Map read from the .obj file 
     */
    async initialize(device: GPUDevice, urls: MaterialURLs, materialMap: MaterialMap) {
        this.device = device;
        const depthLayers = Object.keys(materialMap).length;

        await this.integrateTextures(urls, materialMap);

         this.view = this.textureArray.createView({
            format: "rgba8unorm",
            dimension: "2d-array",
            aspect: "all",
            baseMipLevel: 0,
            mipLevelCount: 1,
            baseArrayLayer: 0,
            arrayLayerCount: depthLayers,
        });

        this.sampler = this.device.createSampler({
            magFilter: "linear",
            minFilter: "linear",
            addressModeU: 'repeat',
            addressModeV: 'repeat',
        });
    }

    private async integrateTextures(textureURLs: {[materialName: string] : string}, materialMap: MaterialMap){
        const depthLayers = Object.keys(materialMap).length;
        const textureDescriptor: GPUTextureDescriptor = {
            dimension: '2d',
            size: {
                width: 1920,
                height: 1080,
                depthOrArrayLayers: depthLayers
            },
            format: "rgba8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
        }

        this.textureArray = this.device.createTexture(textureDescriptor);

        let layer = 0;
        for(const material of Object.keys(materialMap)){
            const url = textureURLs[material] || this.defaultImageURL || "";
            await this.loadImageBitmaps(url, layer);
            
            layer++;
        }
    }

    private async loadAndResizeImage(imageData: ImageBitmap): Promise<ImageBitmap> {
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;

        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(imageData, 0, 0, 1920, 1080);
    
        return createImageBitmap(canvas);
    }

    private async loadImageBitmaps(url: string, layer: number) {
        const filename: string = url;
        const response: Response = await fetch(filename);
        const blob: Blob = await response.blob();

        let imageData = await createImageBitmap(blob);
        if(imageData.width != 1920 || imageData.height != 1080){
            imageData = await this.loadAndResizeImage(imageData);
        }

        this.device.queue.copyExternalImageToTexture(
            {source: imageData},
            {texture: this.textureArray, origin: {x: 0, y: 0, z: layer}},
            [1920, 1080]
        );
    }

    /**
     * Creates the {@link GPUBindGroupLayout} for the Object
     * @param device - The {@link GPUDevice} in use
     * @returns - {@link GPUBindGroupLayout}
     */
    async createMaterialObjectBindGroupLayout(device: GPUDevice = this.device){
        this.bindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { 
                        viewDimension: "2d-array",
                        sampleType: "float" 
                    },  // Um único binding para o array de texturas
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {},  // Binding para o sampler
                }
            ],
        });
        return this.bindGroupLayout;
    }

    /**
     * Sets the default image to use for unmapped textures
     * @param defaultImageURL - The image URL
    */
    async setDefaultImageURL(defaultImageURL: string){
        this.defaultImageURL = defaultImageURL.toString();
    }

    /**
     * Creates the {@link GPUBindGroup} for the Object
     * @param device - The {@link GPUDevice} in use
     * @returns - {@link GPUBindGroup}
     */
    async createMaterialObjectBindGroup(device: GPUDevice = this.device, bindGroupLayout: GPUBindGroupLayout = this.bindGroupLayout){
        if (!this.view || !this.sampler) {
            console.error("View ou Sampler não foram inicializados corretamente.");
            return;
        }
        this.bindGroup = device.createBindGroup({
            label: "Material Object Bind Group",
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: this.view,
                },
                {
                    binding: 1,
                    resource: this.sampler,
                }
            ],
        });
        
        return this.bindGroup;
    }
}