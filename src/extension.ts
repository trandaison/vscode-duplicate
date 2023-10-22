import * as vscode from 'vscode';
import { parse } from 'path';
import { stat } from 'fs-extra';
import { PluginSettings } from './types';

export function activate(context: vscode.ExtensionContext) {
  console.log('vscode-duplicate is now active!');

  let disposable = vscode.commands.registerCommand(
    'duplicate.execute',
    (uri: vscode.TextDocument | vscode.Uri) => {
      const settings = vscode.workspace
        .getConfiguration()
        .get('duplicate') as PluginSettings;

      if (!uri || !(uri as vscode.Uri).fsPath) {
        const { activeTextEditor } = vscode.window;
        if (!activeTextEditor) {
          vscode.window.showErrorMessage('No active text editor');
          return;
        }

        duplicate(activeTextEditor.document.uri, settings);
      }

      duplicate(uri as vscode.Uri, settings);
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {}

async function duplicate(uri: vscode.Uri, settings: PluginSettings) {
  const { fsPath } = uri;
  const { ext, name, dir } = parse(fsPath);
  const fileStats = await stat(fsPath);
  const isFile = fileStats.isFile();
  const isDirectory = fileStats.isDirectory();
  let newName = `${name}${settings.suffix}${settings.keepFileExt ? ext : ''}`;

  let i = 1;
  while (true) {
    const fileExists = await exists(newName, dir, isFile);
    if (fileExists) {
      newName = `${name}${settings.suffix} (${i})${
        settings.keepFileExt ? ext : ''
      }`;
      i++;
    } else {
      break;
    }
  }
  const newPath = `${dir}/${newName}`;

  try {
    const newUri = vscode.Uri.file(newPath);
    if (isFile) {
      await vscode.workspace.fs.copy(uri, vscode.Uri.file(newPath));
      const newFile = await vscode.workspace.openTextDocument(newUri);
      await vscode.window.showTextDocument(newFile);
      await vscode.commands.executeCommand('renameFile');
    } else if (isDirectory) {
      const { fsPath } = newUri;
      const { name } = parse(fsPath);
      const finalName = await vscode.window.showInputBox({
        value: name,
        prompt: 'Enter new folder name',
        validateInput: async (value) => {
          if (value === '') {
            return "Folder name cannot be empty (Press 'Esccape' to cancel)";
          }
          const dirExists = await exists(value, dir, false);
          if (dirExists) {
            return 'Folder already exists';
          }
        },
      });
      if (finalName === undefined) {
        return;
      }

      const finalPath = `${dir}/${finalName}`;
      await vscode.workspace.fs.copy(uri, vscode.Uri.file(finalPath));
    } else {
      vscode.window.showErrorMessage('Not a file or directory');
    }
  } catch (error: any) {
    vscode.window.showErrorMessage(error.message);
  }
}

async function exists(name: string, dir?: string, isFile: boolean = true) {
  try {
    const stats = await stat(dir ? `${dir}/${name}` : name);
    return isFile ? stats.isFile() : stats.isDirectory();
  } catch (error) {
    return false;
  }
}
