import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { errorInterceptor } from '../../../core/interceptors/error.interceptor';
import { Team } from '../../../core/models/api.models';
import { TeamFormComponent } from './team-form.component';

function setup() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
  });
  return TestBed.inject(HttpTestingController);
}

const type = (element: HTMLInputElement, value: string) => {
  element.value = value;
  element.dispatchEvent(new Event('input'));
};

describe('TeamFormComponent', () => {
  it('does not call the API while the name is blank', () => {
    const http = setup();
    const fixture = TestBed.createComponent(TeamFormComponent);
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    http.expectNone('/api/teams');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Enter a team name');
  });

  it('creates a team with a trimmed name and a null empty code', () => {
    const http = setup();
    const fixture = TestBed.createComponent(TeamFormComponent);
    const saved: Team[] = [];
    fixture.componentInstance.saved.subscribe((t) => saved.push(t));
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    type(element.querySelector<HTMLInputElement>('#tf-name')!, '  Spin Doctors ');
    element.querySelector('form')!.dispatchEvent(new Event('submit'));

    const request = http.expectOne({ method: 'POST', url: '/api/teams' });
    expect(request.request.body).toEqual({ name: 'Spin Doctors', code: null });
    const team: Team = { id: 3, name: 'Spin Doctors', code: null, isActive: true, createdAt: '2026-11-01T10:00:00' };
    request.flush(team, { status: 201, statusText: 'Created' });

    expect(saved).toEqual([team]);
  });

  it('shows the backend message when the name is taken', () => {
    const http = setup();
    const fixture = TestBed.createComponent(TeamFormComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    type(element.querySelector<HTMLInputElement>('#tf-name')!, 'Aces');
    element.querySelector('form')!.dispatchEvent(new Event('submit'));
    http.expectOne('/api/teams').flush(
      { status: 400, title: 'Unable to create team', detail: 'A team named "Aces" already exists.', code: 'Team.DuplicateName' },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain('already exists');
  });
});
