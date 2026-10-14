import { Component, ElementRef, Injectable, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { firstValueFrom } from 'rxjs';

@Component({
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './confirm-dialog.html',
})
export class ConfirmDialog {
  protected readonly message = inject<string>(MAT_DIALOG_DATA);
}

@Component({
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, FormsModule],
  templateUrl: './prompt-dialog.html',
})
export class PromptDialog {
  protected readonly label = inject<string>(MAT_DIALOG_DATA);
  protected readonly ref = inject<MatDialogRef<PromptDialog, string | null>>(MatDialogRef);
  protected readonly value = signal('');
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  constructor() {
    // Focus manuel : plus fiable que l'autofocus du dialogue pour une saisie immédiate.
    afterNextRender(() => this.field().nativeElement.focus());
  }
}

/** Boîtes de dialogue Material qui remplacent `window.confirm` et `window.prompt`. */
@Injectable({ providedIn: 'root' })
export class Dialogs {
  private readonly dialog = inject(MatDialog);

  async confirm(message: string): Promise<boolean> {
    return !!(await firstValueFrom(this.dialog.open<ConfirmDialog, string, boolean>(ConfirmDialog, { data: message }).afterClosed()));
  }

  /** Demande un texte ; `null` si l'utilisateur annule. */
  async prompt(label: string): Promise<string | null> {
    return (await firstValueFrom(this.dialog.open<PromptDialog, string, string | null>(PromptDialog, { data: label, autoFocus: false }).afterClosed())) ?? null;
  }
}
