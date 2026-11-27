# Sample data

Part of the spec. `docs/spec.md` has the summary of the whole product and the index of every area file, concern and rule.

The sample data is for a business that sells software and services to other businesses: licenses, implementation projects, integrations, training and support renewals. Deal names pair the customer with the work, such as "Harbor Logistics fleet analytics" or "Brightline Retail POS integration".

- **Teammates:** four made-up people, so the screens look like a team's: Dana Holt, Joel Abara, Nora Lindqvist and Wes Moreno, each with a display name and an email at `example.com`, such as `dana.holt@example.com`. Their names don't match any contact's. They have no Supabase accounts, so they can't sign in on the team's app. On this computer they sign in through the stand-in (concern 18).
- **Who added what:** every organization, contact, deal and activity is added by one of the teammates, unevenly, as in a real team: Dana about 40%, Joel 25%, Nora 20% and Wes 15%. A deal's activities are mostly logged by whoever added the deal. About one record in five was last changed by someone other than who added it, and the rest by the same person. A record someone else last changed was changed after it was added. A customer was last changed by whoever won their first deal, since the win changed them (R17). With `--large`, the usual records are the same as without it, and the extra records are spread across the four the same way.
- **Organizations:** about 15, across industries such as software, healthcare, manufacturing, retail, logistics, financial services, education and professional services. One or two have no deals yet.
- **Contacts:** about 40, at every status: about 16 leads, 10 qualified and 14 customers. Every main contact of a won deal is a customer. Two contacts have no organization.
- **Deals:** about 45, worth $5,000 to $150,000 in steps of $500:
  - about 5 each in New, Qualified and Proposal, and 4 in Negotiation, with 3 of the open deals late
  - about 20 won, spread over the past 12 months with at least one in most months, so the monthly charts are full
  - about 6 lost, lost from different stages
- **Stage history:** each deal has a history that fits its stage, spread over the weeks before its close date.
- **Status history:** each contact who became a customer has a status change on the date of their first won deal.
- **Activities:** about 100 over the past 12 months, more of them recent, mixing notes, calls and emails, logged on both contacts and deals. About 20 have follow-ups: about 5 overdue, 6 due in the next 7 days, 3 later, and 6 done.
- **Same every time:** the records, their order and who added and changed each are the same every time the sample data is loaded. Only the dates move, because they're counted back and forward from the day it's loaded.
- **On Supabase:** the sample data is loaded once, when the migrations first create the tables, so the team's Accountable starts with it, teammates included. The tables and the sample data are saved together or not at all. The records keep their ids, so loading then moves each table's id counter past the highest one, and the first record anyone adds gets a new id. After that, only the team's own changes alter it.
