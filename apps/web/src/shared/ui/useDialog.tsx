import { useEffect, useRef, useState, type FormEvent } from "react";

type Options = {
  title: string;
  description: string;
  confirm?: string;
  input?: { label: string; value?: string; required?: boolean };
};
export function useDialog() {
  const [options, setOptions] = useState<Options | null>(null);
  const [value, setValue] = useState("");
  const resolve = useRef<((value: string | null) => void) | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  function ask(next: Options): Promise<string | null> {
    if (resolve.current) return Promise.resolve(null);
    opener.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setValue(next.input?.value ?? "");
    setOptions(next);
    return new Promise((done) => {
      resolve.current = done;
    });
  }
  function finish(result: string | null) {
    const done = resolve.current;
    resolve.current = null;
    ref.current?.close();
    setOptions(null);
    done?.(result);
    opener.current?.focus();
  }
  useEffect(() => {
    if (options && ref.current && !ref.current.open) ref.current.showModal();
  }, [options]);
  useEffect(
    () => () => {
      resolve.current?.(null);
      resolve.current = null;
    },
    [],
  );
  const dialog = options && (
    <dialog
      ref={ref}
      className="app-dialog"
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        finish(null);
      }}
    >
      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          finish(value);
        }}
      >
        <span className="kicker">ENTRE NÓS</span>
        <h2 id="dialog-title">{options.title}</h2>
        <p>{options.description}</p>
        {options.input && (
          <label>
            {options.input.label}
            <input
              autoFocus
              value={value}
              required={options.input.required}
              maxLength={500}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => finish(null)}
          >
            Cancelar
          </button>
          <button className="btn btn-navy">
            {options.confirm || "Confirmar"}
          </button>
        </div>
      </form>
    </dialog>
  );
  return { ask, dialog };
}
