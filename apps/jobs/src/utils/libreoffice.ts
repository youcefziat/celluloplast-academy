import { execFile } from 'node:child_process';
import { mkdir, open, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const CONVERSION_TIMEOUT_MS = 180_000;
const POWERPOINT_EXTENSIONS = new Set(['.ppt', '.pptx']);
const MACRO_SECURITY_CONFIGURATION = `<?xml version="1.0" encoding="UTF-8"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry">
  <item oor:path="/org.openoffice.Office.Common/Security/Scripting">
    <prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop>
  </item>
</oor:items>
`;

/**
 * Convert one PowerPoint file with a fresh, isolated LibreOffice profile.
 * `execFile` is deliberate: no shell parses the original filename or paths.
 */
export async function convertPowerPointToPdf(
  inputPath: string,
  outputDirectory: string,
  profileDirectory: string
): Promise<string> {
  const sourceExtension = path.extname(inputPath).toLowerCase();
  if (!POWERPOINT_EXTENSIONS.has(sourceExtension)) {
    throw new Error(`Unsupported PowerPoint extension: ${sourceExtension || '(missing)'}`);
  }

  const profileUserDirectory = path.join(profileDirectory, 'user');
  await mkdir(profileUserDirectory, { recursive: true });
  await writeFile(path.join(profileUserDirectory, 'registrymodifications.xcu'), MACRO_SECURITY_CONFIGURATION, {
    encoding: 'utf8',
    flag: 'wx'
  });

  const profileUrl = pathToFileURL(profileDirectory).href;
  const argumentsList = [
    '--headless',
    '--nologo',
    '--nodefault',
    '--nolockcheck',
    '--norestore',
    '--nofirststartwizard',
    `-env:UserInstallation=${profileUrl}`,
    '--convert-to',
    'pdf:impress_pdf_Export',
    '--outdir',
    outputDirectory,
    inputPath
  ];

  await execFileAsync('libreoffice', argumentsList, {
    cwd: outputDirectory,
    timeout: CONVERSION_TIMEOUT_MS,
    killSignal: 'SIGKILL',
    maxBuffer: 1024 * 1024,
    windowsHide: true,
    env: process.env
  });

  const outputPath = path.join(outputDirectory, `${path.basename(inputPath, sourceExtension)}.pdf`);
  const outputStat = await stat(outputPath);
  if (!outputStat.isFile() || outputStat.size === 0) {
    throw new Error('LibreOffice produced an empty PDF');
  }

  const outputFile = await open(outputPath, 'r');
  const header = Buffer.alloc(5);
  await outputFile.read(header, 0, header.length, 0);
  await outputFile.close();
  if (header.toString('ascii') !== '%PDF-') {
    throw new Error('LibreOffice output is not a valid PDF file');
  }

  return outputPath;
}
