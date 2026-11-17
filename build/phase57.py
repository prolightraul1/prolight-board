# Costs off the top (fin.deduct) for every split. Applied after phase56.py.
rep('const R=rates(), p=Number(f&&f.price)||0, custom=hasPct(f&&f.ssPct);', 'const R=rates(), p=netPrice(f), custom=hasPct(f&&f.ssPct);')
