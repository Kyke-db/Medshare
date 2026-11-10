// Foto de perfil (o inicial del nombre) + utilidad para reducir la imagen antes de subirla
export default function Avatar({ user, size = 40 }) {
  const s = { width: size, height: size, fontSize: size * 0.4 };
  return user?.photo ? (
    <img src={user.photo} alt="" style={s} className="rounded-full object-cover shrink-0 anim-pop" />
  ) : (
    <div style={s} className="rounded-full bg-brand text-white grid place-items-center font-bold shrink-0 anim-pop">{(user?.name || "?")[0]}</div>
  );
}

// Recorta la imagen a un cuadrado y la reduce (así la base de datos no se llena de fotos pesadas)
export function resizeImage(file, size = 256) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const m = Math.min(img.width, img.height);
      c.getContext("2d").drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => reject(new Error("No se pudo leer la imagen"));
    img.src = url;
  });
}
