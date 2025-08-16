import { checkSwiftlatexConfig, SWIFTLATEX_TOKEN, SWIFTLATEX_ORIGIN } from '@/config';
import { compile as swiftlatexCompile, CompileResult } from './swiftlatexClient';

export function compile(latex: string) {
  checkSwiftlatexConfig();
  console.log('[Export] SwiftLaTeX compile starting…');
  const { controller, promise } = swiftlatexCompile({ mainTex: latex });
  const wrapped = promise.then((res: CompileResult) => {
    if (res.ok) {
      console.log(`[Export] SwiftLaTeX compile ok (bytes: ${res.pdf.length})`);
    } else {
      console.error(
        '[Export] SwiftLaTeX compile failed',
        { status: res.status, error: res.error, tokenPresent: !!SWIFTLATEX_TOKEN, originPresent: !!SWIFTLATEX_ORIGIN }
      );
    }
    return res;
  });
  return { controller, result: wrapped };
}
