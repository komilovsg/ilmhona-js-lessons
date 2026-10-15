export const EXPLAIN_STRINGS = {
  network: 'Ошибка сети: проверьте адрес, интернет или CORS у API.',
};

/** Human-readable hints for common runtime errors (Russian, shown to students). */
export function explain(msg: string): string {
  let m: RegExpMatchArray | null;
  if (/Failed to fetch|NetworkError|Load failed|Network request failed/i.test(msg)) return EXPLAIN_STRINGS.network;
  if ((m = msg.match(/(\S+) is not defined/))) return `Переменная «${m[1]}» не найдена: её не объявили или она не видна в этом месте (область видимости).`;
  if ((m = msg.match(/access '(\S+)' before initialization|access lexical declaration '(\S+)'/))) return `К «${m[1] || m[2]}» обратились раньше, чем она объявлена через let/const. Перенесите вызов ниже объявления.`;
  if ((m = msg.match(/(\S+) is not a function/))) return `«${m[1]}» — не функция. Проверьте имя, скобки и порядок объявления.`;
  if (/Cannot read propert|is undefined|is null/.test(msg)) return 'Пытаемся взять свойство у undefined или null. Проверьте, что объект или элемент действительно существует.';
  if (/Assignment to constant|invalid assignment to const/.test(msg)) return 'Нельзя переприсвоить const. Используйте let, если значение должно меняться.';
  if (/has already been declared|redeclaration/.test(msg)) return 'Эта переменная уже объявлена выше. Дайте другое имя или уберите повторный let/const.';
  if (/JSON/.test(msg)) return 'Строка не похожа на правильный JSON: ключи и строки — только в двойных кавычках, без лишних запятых.';
  if (/SyntaxError|Unexpected|missing/.test(msg)) return 'Синтаксическая ошибка: проверьте скобки (), {}, [] и кавычки.';
  return '';
}
