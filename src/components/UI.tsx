import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { PawPrint, X } from './icons';

export function Brand({ light = false }: { light?: boolean }) {
  return <span className={`brand${light ? ' brand-light' : ''}`}><span className="brand-symbol"><PawPrint size={22} aria-hidden="true"/></span><span className="wordmark">petlog<span>.</span></span></span>;
}

export function PetAvatar({ photo, name, className = '' }: { photo?: string; name: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo]);
  return <span className={`pet-avatar ${className}`}><img src={!failed && photo ? photo : '/app-logo.png'} alt="" onError={() => { if (photo) setFailed(true); }}/><span className="sr-only">{name}</span></span>;
}

export function Dialog({ title, children, onClose, busy = false, destructive = false }: { title: string; children: ReactNode; onClose: () => void; busy?: boolean; destructive?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const element = ref.current;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => { element?.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  return <dialog ref={ref} className="dialog-shell" aria-labelledby={id} role={destructive ? 'alertdialog' : 'dialog'} onCancel={event => { event.preventDefault(); if (!busy) closeRef.current(); }} onClick={event => { if (event.target === event.currentTarget && !busy) closeRef.current(); }}><div className="modal"><div className="modal-head"><h2 className="section-title" id={id}>{title}</h2><button type="button" className="icon-button" disabled={busy} onClick={onClose} aria-label="დახურვა"><X size={20}/></button></div>{children}</div></dialog>;
}
