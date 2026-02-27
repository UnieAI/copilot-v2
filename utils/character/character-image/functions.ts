import { CharacterType } from "../type";

export const handleDrag = (e: React.DragEvent, setDragActive: (value: React.SetStateAction<boolean>) => void) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
        setDragActive(true);
    } else if (e.type === "dragleave") {
        setDragActive(false);
    }
};

export const handleDrop = (e: React.DragEvent, setDragActive: (value: React.SetStateAction<boolean>) => void, setCharacter: (value: React.SetStateAction<CharacterType>) => void) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFiles(e.dataTransfer.files[0], setCharacter);
    }
};

export const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, setCharacter: (value: React.SetStateAction<CharacterType>) => void) => {
    const file = e.target.files?.[0];
    if (file) {
        handleFiles(file, setCharacter);
    }
};

const handleFiles = (file: File, setCharacter: (value: React.SetStateAction<CharacterType>) => void) => {
    if (file && file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            setCharacter((prev) => ({ ...prev, image: base64String }));
        }
        reader.readAsDataURL(file);
    }
};