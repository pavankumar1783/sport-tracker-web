import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Loading placeholder: `rows` bars, or a single block with an explicit height. */
@Component({
  selector: 'st-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="status" aria-label="Loading" class="wrap">
      @for (row of rowList(); track row) {
        <span class="skeleton" [style.height]="height()" [style.width]="row === rows() - 1 && rows() > 1 ? '60%' : '100%'"></span>
      }
    </div>
  `,
  styles: `
    .wrap {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
  `,
})
export class SkeletonComponent {
  readonly rows = input(3);
  readonly height = input('18px');
  protected readonly rowList = computed(() => Array.from({ length: this.rows() }, (_, i) => i));
}
