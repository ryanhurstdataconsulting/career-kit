# Your career kit

This is a little something I made for you: a job-search assistant that does the
busy work so the hunt feels a lot lighter. You talk to it like a person, and it
handles the rest — it gets to know your background, finds and rates jobs that
fit you, writes a resume tailored to each one, and fills in the application
forms.

Here's the honest promise, right up front: **it fills in applications for you,
but it never submits one. That final click is always yours.** You look
everything over, and you press Submit yourself — every single time. That's not a
promise I'm asking you to take on faith; it's enforced by the code itself, so it
can't happen any other way.

Everything below is just detail. Take it at your own pace.

## The fastest way to start

If you'd like to skip straight to it, open the Claude app, go to the **Code**
tab, and paste this message in:

> Set up my career kit from
> https://github.com/ryanhurstdataconsulting/career-kit — clone it into my home
> folder, install it, and then walk me through connecting Simplify. I'll click
> anything that needs my sign-in.

That's it. Claude will download the kit, install it, and then take you through
the one-time Simplify setup step by step — pausing whenever something (like
signing in) is yours to do. You don't need to read the rest of this first; it's
here if you ever want the fuller picture.

(Already have the folder on your Mac? Even simpler — just open it in the Code
tab and Claude will pick up from there.)

## What you'll need

- **A Mac** — you already have one.
- **The Claude app**, signed in with your subscription. This is the brain of the
  whole thing.
- **Google Chrome.** If it isn't already on your Mac, it's free at
  https://www.google.com/chrome/.
- **A free Simplify account.** You don't have to set this up now — you'll create
  it in a moment, during setup, and it's free.

## Step 1 — Set it up

Open this folder in the Claude app's **Code** tab. Claude will notice the kit
isn't installed yet and offer to set it up for you. Just say yes. It takes a few
minutes the first time, and it's completely safe to run again later if you ever
need to.

(If you'd rather do it yourself, you can open the Terminal app and run
`./setup.sh` — but you won't usually need to. Letting Claude handle it is the
easy way.)

## Step 2 — Open your job-hunt window

Your job search gets its own separate Chrome window, kept apart from your
everyday browsing. To open it, ask Claude to start it for you, or run:

```
./apply/launch-chrome.sh
```

A fresh Chrome window will appear. **The first time**, do three quick things
inside that window:

1. Go to https://simplify.jobs/copilot and add the Simplify Copilot extension.
2. Create your free Simplify account.
3. Sign in.

Simplify is a little helper that fills in application forms quickly. It lives
only in this special window, so it never touches your normal Chrome.

## Step 3 — Your first conversation

Before you start, drop your resume into the `intake` folder so Claude can read
it and save you a lot of typing. A PDF is perfect (a Word file works too). No
resume handy? You can save your LinkedIn profile as one: open your profile,
choose **More**, then **Save to PDF**, and drop that in.

Then just say:

```
/intake
```

Claude will interview you — gently, one topic at a time — about your background,
what you're looking for, and what matters to you. It's a relaxed conversation,
about fifteen minutes, and you can change any answer later. Nothing is set in
stone.

## Using it day to day

Once you're set up, here's the rhythm:

- **Found a job you like?** Paste the link. Claude reads the posting, scores how
  well it fits you, and, if it's a good match, writes a resume tailored to that
  role.
- **Ready to apply?** Say `/apply`. Claude opens the job in your job-hunt
  window, fills in the form (with Simplify's help), attaches your tailored
  resume, and asks you about anything it doesn't already know. Then it stops and
  hands it back to you: look over every field — especially anything it filled in
  for you — and when it all looks right, click Submit yourself.
- **Want the big picture?** Say `/jobs` for your list of jobs, sorted by best
  fit, with where each one stands.

## What to expect

Filling in forms automatically works better on some job sites than others.
Rather than promise perfection, here's the honest picture:

- **Greenhouse and Lever** (very common): nearly everything fills in — about
  85–90%.
- **Workday:** most of it — about 70%.
- **iCIMS:** roughly half — about 40–50%, so you'll add a bit more yourself.

The short version: some sites fill in almost everything, and some need a little
more from you. Whenever Claude hits a question it can't answer, it simply asks
you — and it remembers your answer for next time, so you only answer once. And
whatever the site, please read everything over before you submit.

## Your privacy

Everything stays on your Mac. Your answers, your profile, and your applications
are never uploaded anywhere by this kit.

The optional demographic questions some applications ask — race, gender, and the
like — are always yours to skip. The kit leaves them set to "Prefer not to
answer" unless you tell it otherwise.

## If something seems off

Don't worry about fixing anything yourself. Just tell Claude what happened, in
plain words — "the Chrome window won't open," or "it didn't fill in the form."
Claude can run its own quick health check and sort out most things on its own.
(For the curious, that check is `node apply/doctor.mjs` — but you never have to
remember that. Telling Claude is always enough.)

## One optional extra

There's a way to run the get-to-know-you interview through a separate service
called Poe instead of the Claude app. It's completely optional, and most people
won't need it — but if you're ever curious, it's written up in
`docs/POE-VARIANT.md`.

That's it. Take it at your own pace, and go get the job. You've got this.
