(function () {
    "use strict";

    async function compressUploadImage(file, maxDimension) {
        if (!file || !file.type || !file.type.startsWith("image/")) return file;
        try {
            let bitmap;
            if (typeof createImageBitmap === "function") {
                bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
            } else {
                bitmap = await new Promise((resolve, reject) => {
                    const image = new Image();
                    const objectUrl = URL.createObjectURL(file);
                    image.onload = () => { URL.revokeObjectURL(objectUrl); resolve(image); };
                    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Image decode failed")); };
                    image.src = objectUrl;
                });
            }
            const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(bitmap.width * scale));
            canvas.height = Math.max(1, Math.round(bitmap.height * scale));
            const context = canvas.getContext("2d");
            context.fillStyle = "#fff";
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            if (typeof bitmap.close === "function") bitmap.close();
            const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.8));
            if (!blob) return file;
            return new File([blob], "upload.jpg", { type: "image/jpeg", lastModified: Date.now() });
        } catch (error) {
            console.warn("Image compression failed; sending original.", error);
            return file;
        }
    }

    window.RamjicartImageCompression = { compressUploadImage };
})();
