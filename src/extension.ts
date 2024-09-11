import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "wikimd" is now active!');

	// Register the command to create/open wiki links
	const disposable = vscode.commands.registerCommand('wikimd.openWikiLink', openWikiLink);

	// Register the provider for the wiki links
	const provider = vscode.languages.registerDocumentLinkProvider({ language: 'markdown' }, new WikiLinkProvider());

	// Register the completion provider for wiki links
	const completionProvider = vscode.languages.registerCompletionItemProvider(
		{ language: 'markdown' },
		new WikiLinkCompletionProvider(),
		'[' // Trigger completion after [
	);

	context.subscriptions.push(disposable, provider, completionProvider);
}

class WikiLinkProvider implements vscode.DocumentLinkProvider {
	provideDocumentLinks(document: vscode.TextDocument): vscode.DocumentLink[] {
		const links: vscode.DocumentLink[] = [];
		const regex = /\[\[(.*?)\]\]/g;
		const text = document.getText();
		let match = undefined;

		while ((match = regex.exec(text)) !== null) {
			const startPos = document.positionAt(match.index);
			const endPos = document.positionAt(match.index + match[0].length);
			const range = new vscode.Range(startPos, endPos);
			const fileName = `${match[1]}.md`;
			const uri = vscode.Uri.file(path.join(path.dirname(document.uri.fsPath), fileName));
			const link = new vscode.DocumentLink(range, uri);
			link.tooltip = "Open or create note";
			links.push(link);
		}

		return links;
	}
}

class WikiLinkCompletionProvider implements vscode.CompletionItemProvider {
	async provideCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		token: vscode.CancellationToken,
		context: vscode.CompletionContext
	): Promise<vscode.CompletionItem[] | vscode.CompletionList> {
		const linePrefix = document.lineAt(position).text.substr(0, position.character);
		if (!linePrefix.endsWith('[[')) {
			return [];
		}

		const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
		if (!workspaceFolder) {
			return [];
		}

		const files = await this.getMarkdownFiles(workspaceFolder.uri.fsPath);
		
		// Sort files by path length (shortest first)
		files.sort((a, b) => a.relativePath.length - b.relativePath.length);

		return files.map(file => {
			const completionItem = new vscode.CompletionItem(file.name, vscode.CompletionItemKind.File);
			completionItem.insertText = file.relativePath;
			completionItem.detail = file.relativePath;
			completionItem.command = {
				command: 'editor.action.triggerSuggest',
				title: 'Re-trigger completions...'
			};
			return completionItem;
		});
	}

	private async getMarkdownFiles(rootPath: string): Promise<Array<{ name: string, relativePath: string }>> {
		const files: Array<{ name: string, relativePath: string }> = [];
		const walk = async (dir: string) => {
			const entries = await fs.promises.readdir(dir, { withFileTypes: true });
			for (const entry of entries) {
				const fullPath = path.join(dir, entry.name);
				if (entry.isDirectory()) {
					await walk(fullPath);
				} else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.md') {
					const relativePath = path.relative(rootPath, fullPath);
					files.push({
						name: path.basename(entry.name, '.md'),
						relativePath: relativePath.replace(/\\/g, '/').replace(/\.md$/, '')
					});
				}
			}
		};
		await walk(rootPath);
		return files;
	}
}

async function openWikiLink(uri: vscode.Uri) {
	if (!fs.existsSync(uri.fsPath)) {
		const dir = path.dirname(uri.fsPath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		fs.writeFileSync(uri.fsPath, '');
	}
	const document = await vscode.workspace.openTextDocument(uri);
	await vscode.window.showTextDocument(document);
}

// This method is called when your extension is deactivated
export function deactivate() {}
